import { applyCollectibleAcquired, startAutoQuests } from "shared/quests/QuestEngine";
import { decodeQuestProfile } from "shared/quests/QuestProfileCodec";
import { validateQuestProfileAgainstDefinitions } from "shared/quests/QuestProfileDefinitionValidator";
import { CollectibleAcquiredEvent, QuestDefinition, QuestEngineResult, QuestProfile } from "shared/quests/QuestTypes";

import { RepositoryResult } from "./persistence/QuestProfileRepository";
import { ResilientQuestProfileStore } from "./persistence/ResilientQuestProfileStore";

export type ProfileLoadResult =
	{ readonly ok: true; readonly profile: QuestProfile } | { readonly ok: false; readonly error: string };

export class QuestProfileService {
	private readonly profiles = new Map<string, QuestProfile>();

	public constructor(
		private readonly store: ResilientQuestProfileStore,
		private readonly definitions: ReadonlyArray<QuestDefinition>,
	) {}

	public load(profileKey: string, now = os.time()): ProfileLoadResult {
		const loaded = this.profiles.get(profileKey);
		if (loaded !== undefined) {
			return { ok: true, profile: loaded };
		}

		const stored = this.store.load(profileKey);
		if (!stored.ok) {
			return { ok: false, error: stored.error };
		}

		const decoded = decodeQuestProfile(stored.value);
		if (!decoded.ok) {
			return decoded;
		}
		const definitionError = validateQuestProfileAgainstDefinitions(decoded.profile, this.definitions);
		if (definitionError !== undefined) {
			return { ok: false, error: definitionError };
		}

		const profile = startAutoQuests(decoded.profile, this.definitions, now);
		this.profiles.set(profileKey, profile);
		return { ok: true, profile };
	}

	public get(profileKey: string): QuestProfile | undefined {
		return this.profiles.get(profileKey);
	}

	public applyCollectible(
		profileKey: string,
		event: CollectibleAcquiredEvent,
		now = os.time(),
	): QuestEngineResult | undefined {
		const profile = this.profiles.get(profileKey);
		if (profile === undefined) {
			return undefined;
		}

		const result = applyCollectibleAcquired(profile, this.definitions, event, now);
		if (result.profile !== profile) {
			this.profiles.set(profileKey, result.profile);
		}
		return result;
	}

	public save(profileKey: string): RepositoryResult<void> {
		const profile = this.profiles.get(profileKey);
		return profile === undefined
			? { ok: false, error: `Profile '${profileKey}' is not loaded.`, retryable: false }
			: this.store.save(profileKey, profile);
	}

	public unload(profileKey: string): RepositoryResult<void> {
		const profile = this.profiles.get(profileKey);
		const result =
			profile === undefined
				? { ok: false as const, error: `Profile '${profileKey}' is not loaded.`, retryable: false }
				: this.store.release(profileKey, profile);
		if (result.ok) {
			this.profiles.delete(profileKey);
		}
		return result;
	}
}
