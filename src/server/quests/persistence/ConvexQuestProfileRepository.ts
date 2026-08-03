import { QuestProfile } from "shared/quests/QuestTypes";

import { ConvexHttpResult, ConvexHttpTransport } from "./ConvexHttpTransport";
import { QuestProfileRepository, RepositoryResult } from "./QuestProfileRepository";

const ACQUIRE_PATH = "/v1/player-profile/acquire";
const SAVE_PATH = "/v1/player-profile/save";
const RELEASE_PATH = "/v1/player-profile/release";

export interface ConvexQuestProfileRepositoryOptions {
	readonly serverId: string;
	readonly leaseSeconds: number;
	readonly createId: () => string;
	readonly legacyRepository?: QuestProfileRepository;
}

interface ProfileSession {
	readonly id: string;
	revision: number;
}

interface PendingWrite {
	readonly id: string;
	readonly profile: QuestProfile;
}

interface ResponseRecord {
	readonly [key: string]: unknown;
}

type RepositoryFailure = { readonly ok: false; readonly error: string; readonly retryable: boolean };

function asRecord(value: unknown): ResponseRecord | undefined {
	return typeIs(value, "table") ? (value as ResponseRecord) : undefined;
}

function readNonNegativeInteger(record: ResponseRecord, key: string): number | undefined {
	const value = record[key];
	return typeIs(value, "number") && value >= 0 && value < math.huge && math.floor(value) === value
		? value
		: undefined;
}

function requestFailure(result: ConvexHttpResult, operation: string): RepositoryFailure | undefined {
	if (!result.ok) return result;
	if (result.statusCode === 429 || result.statusCode >= 500) {
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

export class ConvexQuestProfileRepository implements QuestProfileRepository {
	private readonly sessions = new Map<string, ProfileSession>();
	private readonly pendingAcquisitions = new Map<string, string>();
	private readonly pendingSaveOperations = new Map<string, PendingWrite>();
	private readonly pendingReleaseOperations = new Map<string, PendingWrite>();
	private readonly activeWrites = new Set<string>();

	public constructor(
		private readonly transport: ConvexHttpTransport,
		private readonly options: ConvexQuestProfileRepositoryOptions,
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

		const body = asRecord(response.body);
		if (response.statusCode === 409 && body?.status === "leased") {
			return { ok: false, error: `Profile '${profileKey}' is active on another server.`, retryable: true };
		}
		const failure = requestFailure(response, "profile acquire");
		if (failure !== undefined) {
			if (!failure.retryable) this.pendingAcquisitions.delete(profileKey);
			return failure;
		}

		const revision = body === undefined ? undefined : readNonNegativeInteger(body, "revision");
		if (body?.status !== "ok" || revision === undefined || !typeIs(body.migrationRequired, "boolean")) {
			this.pendingAcquisitions.delete(profileKey);
			return { ok: false, error: "Convex returned a malformed profile acquire response.", retryable: false };
		}

		if (body.migrationRequired && this.options.legacyRepository !== undefined) {
			const legacy = this.options.legacyRepository.load(profileKey);
			if (!legacy.ok) return legacy;
			this.sessions.set(profileKey, { id: sessionId, revision });
			this.pendingAcquisitions.delete(profileKey);
			return legacy;
		}

		this.sessions.set(profileKey, { id: sessionId, revision });
		this.pendingAcquisitions.delete(profileKey);
		return { ok: true, value: body.profile };
	}

	public save(profileKey: string, profile: QuestProfile): RepositoryResult<void> {
		const pending = this.pendingSaveOperations.get(profileKey);
		if (pending !== undefined && pending.profile !== profile) {
			const settled = this.write(profileKey, pending.profile, false);
			if (!settled.ok) return settled;
		}
		return this.write(profileKey, profile, false);
	}

	public release(profileKey: string, profile: QuestProfile): RepositoryResult<void> {
		const pendingSave = this.pendingSaveOperations.get(profileKey);
		if (pendingSave !== undefined) {
			const settled = this.write(profileKey, pendingSave.profile, false);
			if (!settled.ok) return settled;
		}
		return this.write(profileKey, profile, true);
	}

	private write(profileKey: string, profile: QuestProfile, release: boolean): RepositoryResult<void> {
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

	private performWrite(profileKey: string, profile: QuestProfile, release: boolean): RepositoryResult<void> {
		const session = this.sessions.get(profileKey);
		if (session === undefined) {
			return { ok: false, error: `Profile '${profileKey}' has no Convex session.`, retryable: false };
		}

		const operationMap = release ? this.pendingReleaseOperations : this.pendingSaveOperations;
		const operation = operationMap.get(profileKey) ?? { id: this.options.createId(), profile };
		operationMap.set(profileKey, operation);
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
		const responseBody = asRecord(response.body);
		if (response.statusCode === 409) {
			operationMap.delete(profileKey);
			if (responseBody?.status === "session_conflict") {
				return { ok: false, error: `Profile '${profileKey}' session was superseded.`, retryable: false };
			}
			if (responseBody?.status === "revision_conflict") {
				return { ok: false, error: `Profile '${profileKey}' revision is stale.`, retryable: false };
			}
		}
		const failure = requestFailure(response, release ? "profile release" : "profile save");
		if (failure !== undefined) {
			if (!failure.retryable) operationMap.delete(profileKey);
			return failure;
		}

		const revision = responseBody === undefined ? undefined : readNonNegativeInteger(responseBody, "revision");
		if (responseBody?.status !== "ok" || revision === undefined) {
			operationMap.delete(profileKey);
			return { ok: false, error: "Convex returned a malformed profile write response.", retryable: false };
		}

		session.revision = revision;
		operationMap.delete(profileKey);
		if (release) {
			this.sessions.delete(profileKey);
			this.pendingSaveOperations.delete(profileKey);
		}
		return { ok: true, value: undefined };
	}
}
