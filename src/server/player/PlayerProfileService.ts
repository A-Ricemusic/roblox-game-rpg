import { InventoryItemDefinition, InventoryProfile } from "shared/inventory/InventoryTypes";
import { PlayerProfile } from "shared/player/PlayerProfile";
import { decodePlayerProfile } from "shared/player/PlayerProfileCodec";
import { startAutoQuests } from "shared/quests/QuestEngine";
import { validateQuestProfileAgainstDefinitions } from "shared/quests/QuestProfileDefinitionValidator";
import { QuestDefinition, QuestProfile } from "shared/quests/QuestTypes";

import { RepositoryResult } from "./persistence/PlayerProfileRepository";
import { ResilientPlayerProfileStore } from "./persistence/ResilientPlayerProfileStore";

export type PlayerProfileLoadResult =
	{ readonly ok: true; readonly profile: PlayerProfile } | { readonly ok: false; readonly error: string };

export class PlayerProfileService {
	private readonly profiles = new Map<string, PlayerProfile>();

	public constructor(
		private readonly store: ResilientPlayerProfileStore,
		private readonly questDefinitions: ReadonlyArray<QuestDefinition>,
		private readonly inventoryDefinitions: ReadonlyArray<InventoryItemDefinition>,
	) {}

	public load(profileKey: string, now = os.time()): PlayerProfileLoadResult {
		const existing = this.profiles.get(profileKey);
		if (existing !== undefined) return { ok: true, profile: existing };
		const stored = this.store.load(profileKey);
		if (!stored.ok) return { ok: false, error: stored.error };
		const decoded = decodePlayerProfile(stored.value, this.inventoryDefinitions);
		if (!decoded.ok) return this.failLoadedProfile(profileKey, decoded.error);
		const definitionError = validateQuestProfileAgainstDefinitions(
			decoded.profile.questProfile,
			this.questDefinitions,
		);
		if (definitionError !== undefined) return this.failLoadedProfile(profileKey, definitionError);
		const profile: PlayerProfile = {
			...decoded.profile,
			questProfile: startAutoQuests(decoded.profile.questProfile, this.questDefinitions, now),
		};
		this.profiles.set(profileKey, profile);
		return { ok: true, profile };
	}

	public get(profileKey: string): PlayerProfile | undefined {
		return this.profiles.get(profileKey);
	}

	public updateQuestProfile(profileKey: string, questProfile: QuestProfile): boolean {
		const profile = this.profiles.get(profileKey);
		if (profile === undefined) return false;
		if (profile.questProfile !== questProfile) this.profiles.set(profileKey, { ...profile, questProfile });
		return true;
	}

	public updateInventoryProfile(profileKey: string, inventoryProfile: InventoryProfile): boolean {
		const profile = this.profiles.get(profileKey);
		if (profile === undefined) return false;
		if (profile.inventoryProfile !== inventoryProfile)
			this.profiles.set(profileKey, { ...profile, inventoryProfile });
		return true;
	}

	public save(profileKey: string): RepositoryResult<void> {
		const profile = this.profiles.get(profileKey);
		return profile === undefined
			? { ok: false, error: `Profile '${profileKey}' is not loaded.`, retryable: false }
			: this.store.save(profileKey, profile);
	}

	public unload(profileKey: string): RepositoryResult<void> {
		const profile = this.profiles.get(profileKey);
		if (profile === undefined)
			return { ok: false, error: `Profile '${profileKey}' is not loaded.`, retryable: false };
		const result = this.store.release(profileKey, profile);
		if (result.ok) this.profiles.delete(profileKey);
		return result;
	}

	private failLoadedProfile(profileKey: string, errorMessage: string): PlayerProfileLoadResult {
		const abandoned = this.store.abandon(profileKey);
		return {
			ok: false,
			error: abandoned.ok ? errorMessage : `${errorMessage} Session cleanup also failed: ${abandoned.error}`,
		};
	}
}
