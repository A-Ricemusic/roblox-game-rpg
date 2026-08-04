import { PlayerProfile } from "shared/player/PlayerProfile";
import { asUnknownRecord, isNonNegativeInteger, UnknownRecord } from "shared/RuntimeTypeChecks";

import { ConvexHttpResult, ConvexHttpTransport } from "server/quests/persistence/ConvexHttpTransport";
import { QuestProfileRepository } from "server/quests/persistence/QuestProfileRepository";

import { PlayerProfileRepository, RepositoryResult } from "./PlayerProfileRepository";

const ACQUIRE_PATH = "/v1/player-profile/acquire";
const RENEW_PATH = "/v1/player-profile/renew";
const SAVE_PATH = "/v1/player-profile/save";
const RELEASE_PATH = "/v1/player-profile/release";
const ABANDON_PATH = "/v1/player-profile/abandon";

export interface ConvexPlayerProfileRepositoryOptions {
	readonly serverId: string;
	readonly leaseSeconds: number;
	readonly createId: () => string;
	readonly legacyQuestRepository?: QuestProfileRepository;
}

interface ProfileSession {
	readonly id: string;
	revision: number;
}

interface PendingWrite {
	readonly id: string;
	readonly profile: PlayerProfile;
}

type RepositoryFailure = { readonly ok: false; readonly error: string; readonly retryable: boolean };

function readRevision(record: UnknownRecord | undefined): number | undefined {
	const value = record?.revision;
	return isNonNegativeInteger(value) ? value : undefined;
}

function requestFailure(result: ConvexHttpResult, operation: string): RepositoryFailure | undefined {
	if (!result.ok) return result;
	if (
		result.statusCode === 408 ||
		result.statusCode === 425 ||
		result.statusCode === 429 ||
		result.statusCode >= 500
	) {
		return { ok: false, error: `Convex ${operation} failed with HTTP ${result.statusCode}.`, retryable: true };
	}
	if (result.statusCode === 401 || result.statusCode === 403) {
		return { ok: false, error: `Convex ${operation} authentication failed.`, retryable: false };
	}
	if (result.statusCode < 200 || result.statusCode >= 300) {
		return { ok: false, error: `Convex ${operation} failed with HTTP ${result.statusCode}.`, retryable: false };
	}
	return undefined;
}

export class ConvexPlayerProfileRepository implements PlayerProfileRepository {
	private readonly sessions = new Map<string, ProfileSession>();
	private readonly pendingAcquisitions = new Map<string, string>();
	private readonly pendingSaves = new Map<string, PendingWrite>();
	private readonly pendingReleases = new Map<string, PendingWrite>();
	private readonly pendingAbandons = new Map<string, string>();
	private readonly pendingLegacyMigrations = new Set<string>();
	private readonly activeWrites = new Set<string>();

	public constructor(
		private readonly transport: ConvexHttpTransport,
		private readonly options: ConvexPlayerProfileRepositoryOptions,
	) {
		assert(options.serverId.size() > 0, "Convex serverId must not be empty.");
		assert(
			options.leaseSeconds >= 30 &&
				options.leaseSeconds <= 600 &&
				math.floor(options.leaseSeconds) === options.leaseSeconds,
			"Convex leaseSeconds must be an integer from 30 through 600.",
		);
	}

	public load(profileKey: string): RepositoryResult<unknown> {
		if (this.sessions.has(profileKey)) {
			if (this.pendingLegacyMigrations.has(profileKey)) return this.loadLegacyQuestProfile(profileKey);
			return {
				ok: false,
				error: `Profile '${profileKey}' is already acquired by this server.`,
				retryable: false,
			};
		}
		const sessionId = this.pendingAcquisitions.get(profileKey) ?? this.options.createId();
		this.pendingAcquisitions.set(profileKey, sessionId);
		const response = this.transport.post(ACQUIRE_PATH, {
			profileKey,
			sessionId,
			serverId: this.options.serverId,
			leaseSeconds: this.options.leaseSeconds,
		});
		if (!response.ok) return response;
		const body = asUnknownRecord(response.body);
		if (response.statusCode === 409 && body?.status === "leased") {
			return { ok: false, error: `Profile '${profileKey}' is active on another server.`, retryable: true };
		}
		const failure = requestFailure(response, "profile acquire");
		if (failure !== undefined) {
			if (!failure.retryable) this.pendingAcquisitions.delete(profileKey);
			return failure;
		}
		const revision = readRevision(body);
		if (body?.status !== "ok" || revision === undefined || !typeIs(body.migrationRequired, "boolean")) {
			return { ok: false, error: "Convex returned a malformed profile acquire response.", retryable: true };
		}
		if (body.migrationRequired && this.options.legacyQuestRepository !== undefined) {
			this.sessions.set(profileKey, { id: sessionId, revision });
			this.pendingAcquisitions.delete(profileKey);
			this.pendingLegacyMigrations.add(profileKey);
			return this.loadLegacyQuestProfile(profileKey);
		}
		this.sessions.set(profileKey, { id: sessionId, revision });
		this.pendingAcquisitions.delete(profileKey);
		return { ok: true, value: body.profile };
	}

	public save(profileKey: string, profile: PlayerProfile): RepositoryResult<void> {
		const pending = this.pendingSaves.get(profileKey);
		if (pending !== undefined && pending.profile !== profile) {
			const settled = this.write(profileKey, pending.profile, false);
			if (!settled.ok) return settled;
		}
		return this.write(profileKey, profile, false);
	}

	public renew(profileKey: string): RepositoryResult<void> {
		if (this.activeWrites.has(profileKey)) {
			return { ok: false, error: `Profile '${profileKey}' already has a write in progress.`, retryable: true };
		}
		const session = this.sessions.get(profileKey);
		if (session === undefined) {
			return { ok: false, error: `Profile '${profileKey}' has no Convex session.`, retryable: false };
		}
		this.activeWrites.add(profileKey);
		try {
			const response = this.transport.post(RENEW_PATH, {
				profileKey,
				sessionId: session.id,
				leaseSeconds: this.options.leaseSeconds,
			});
			if (!response.ok) return response;
			const body = asUnknownRecord(response.body);
			if (response.statusCode === 409) {
				this.clearSession(profileKey);
				return {
					ok: false,
					error: `Profile '${profileKey}' ownership was lost during lease renewal.`,
					retryable: false,
					kind: "OwnershipLost",
				};
			}
			const failure = requestFailure(response, "profile lease renewal");
			if (failure !== undefined) return failure;
			const revision = readRevision(body);
			if (body?.status !== "ok" || revision === undefined) {
				return { ok: false, error: "Convex returned a malformed lease renewal response.", retryable: true };
			}
			session.revision = revision;
			return { ok: true, value: undefined };
		} finally {
			this.activeWrites.delete(profileKey);
		}
	}

	public release(profileKey: string, profile: PlayerProfile): RepositoryResult<void> {
		const pending = this.pendingSaves.get(profileKey);
		if (pending !== undefined) {
			const settled = this.write(profileKey, pending.profile, false);
			if (!settled.ok) return settled;
		}
		return this.write(profileKey, profile, true);
	}

	public abandon(profileKey: string): RepositoryResult<void> {
		const sessionId = this.sessions.get(profileKey)?.id ?? this.pendingAcquisitions.get(profileKey);
		if (sessionId === undefined) return { ok: true, value: undefined };
		const operationId = this.pendingAbandons.get(profileKey) ?? this.options.createId();
		this.pendingAbandons.set(profileKey, operationId);
		const response = this.transport.post(ABANDON_PATH, { profileKey, sessionId, operationId });
		if (!response.ok) return response;
		const body = asUnknownRecord(response.body);
		if (response.statusCode === 409 && body?.status === "session_conflict") {
			this.clearSession(profileKey);
			return { ok: true, value: undefined };
		}
		const failure = requestFailure(response, "profile abandon");
		if (failure !== undefined) return failure;
		if (body?.status !== "ok" || readRevision(body) === undefined) {
			return { ok: false, error: "Convex returned a malformed profile abandon response.", retryable: true };
		}
		this.clearSession(profileKey);
		return { ok: true, value: undefined };
	}

	private write(profileKey: string, profile: PlayerProfile, release: boolean): RepositoryResult<void> {
		if (this.activeWrites.has(profileKey)) {
			return { ok: false, error: `Profile '${profileKey}' already has a write in progress.`, retryable: true };
		}
		this.activeWrites.add(profileKey);
		try {
			return this.performWrite(profileKey, profile, release);
		} finally {
			this.activeWrites.delete(profileKey);
		}
	}

	private performWrite(profileKey: string, profile: PlayerProfile, release: boolean): RepositoryResult<void> {
		const session = this.sessions.get(profileKey);
		if (session === undefined) {
			return { ok: false, error: `Profile '${profileKey}' has no Convex session.`, retryable: false };
		}
		const operations = release ? this.pendingReleases : this.pendingSaves;
		const operation = operations.get(profileKey) ?? { id: this.options.createId(), profile };
		operations.set(profileKey, operation);
		const body: Record<string, unknown> = {
			profileKey,
			sessionId: session.id,
			operationId: operation.id,
			expectedRevision: session.revision,
			profile: operation.profile,
		};
		if (!release) body.leaseSeconds = this.options.leaseSeconds;
		const response = this.transport.post(release ? RELEASE_PATH : SAVE_PATH, body);
		if (!response.ok) return response;
		const responseBody = asUnknownRecord(response.body);
		if (response.statusCode === 409) {
			operations.delete(profileKey);
			this.clearSession(profileKey);
			if (responseBody?.status === "session_conflict") {
				return {
					ok: false,
					error: `Profile '${profileKey}' session was superseded.`,
					retryable: false,
					kind: "OwnershipLost",
				};
			}
			if (responseBody?.status === "revision_conflict") {
				return {
					ok: false,
					error: `Profile '${profileKey}' revision is stale.`,
					retryable: false,
					kind: "OwnershipLost",
				};
			}
			return {
				ok: false,
				error: `Profile '${profileKey}' ownership could not be verified.`,
				retryable: false,
				kind: "OwnershipLost",
			};
		}
		const failure = requestFailure(response, release ? "profile release" : "profile save");
		if (failure !== undefined) {
			if (!failure.retryable) operations.delete(profileKey);
			return failure;
		}
		const revision = readRevision(responseBody);
		if (responseBody?.status !== "ok" || revision === undefined) {
			return { ok: false, error: "Convex returned a malformed profile write response.", retryable: true };
		}
		session.revision = revision;
		operations.delete(profileKey);
		if (release) this.clearSession(profileKey);
		return { ok: true, value: undefined };
	}

	private clearSession(profileKey: string): void {
		this.sessions.delete(profileKey);
		this.pendingAcquisitions.delete(profileKey);
		this.pendingSaves.delete(profileKey);
		this.pendingReleases.delete(profileKey);
		this.pendingAbandons.delete(profileKey);
		this.pendingLegacyMigrations.delete(profileKey);
	}

	private loadLegacyQuestProfile(profileKey: string): RepositoryResult<unknown> {
		const repository = this.options.legacyQuestRepository;
		if (repository === undefined) {
			return { ok: false, error: "Legacy quest migration repository is unavailable.", retryable: false };
		}
		const result = repository.load(profileKey);
		if (result.ok) this.pendingLegacyMigrations.delete(profileKey);
		return result;
	}
}
