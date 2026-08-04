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
	private readonly closingProfiles = new Set<string>();
	private readonly quarantinedProfiles = new Map<string, string>();
	private readonly profileGenerations = new Map<string, number>();
	private readonly persistedGenerations = new Map<string, number>();

	public constructor(
		private readonly store: ResilientPlayerProfileStore,
		private readonly questDefinitions: ReadonlyArray<QuestDefinition>,
		private readonly inventoryDefinitions: ReadonlyArray<InventoryItemDefinition>,
	) {}

	public load(profileKey: string, now = os.time()): PlayerProfileLoadResult {
		const existing = this.profiles.get(profileKey);
		if (existing !== undefined) {
			const quarantineReason = this.quarantinedProfiles.get(profileKey);
			if (quarantineReason !== undefined) return { ok: false, error: quarantineReason };
			return this.closingProfiles.has(profileKey)
				? { ok: false, error: `Profile '${profileKey}' is still releasing from a previous session.` }
				: { ok: true, profile: existing };
		}
		const stored = this.store.load(profileKey);
		if (!stored.ok) return this.failLoadedProfile(profileKey, stored.error);
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
		this.profileGenerations.set(profileKey, 1);
		this.persistedGenerations.set(profileKey, 0);
		return { ok: true, profile };
	}

	public get(profileKey: string): PlayerProfile | undefined {
		return this.profiles.get(profileKey);
	}

	public isClosing(profileKey: string): boolean {
		return this.closingProfiles.has(profileKey);
	}

	public isUnavailable(profileKey: string): boolean {
		return this.closingProfiles.has(profileKey) || this.quarantinedProfiles.has(profileKey);
	}

	public getQuarantineReason(profileKey: string): string | undefined {
		return this.quarantinedProfiles.get(profileKey);
	}

	public getLoadedProfileKeys(): string[] {
		const keys = new Array<string>();
		for (const [profileKey] of this.profiles) keys.push(profileKey);
		return keys;
	}

	public updateQuestProfile(profileKey: string, questProfile: QuestProfile): boolean {
		const profile = this.profiles.get(profileKey);
		if (profile === undefined || this.isUnavailable(profileKey)) return false;
		if (profile.questProfile !== questProfile) {
			this.profiles.set(profileKey, { ...profile, questProfile });
			this.markDirty(profileKey);
		}
		return true;
	}

	public updateInventoryProfile(profileKey: string, inventoryProfile: InventoryProfile): boolean {
		const profile = this.profiles.get(profileKey);
		if (profile === undefined || this.isUnavailable(profileKey)) return false;
		if (profile.inventoryProfile !== inventoryProfile) {
			this.profiles.set(profileKey, { ...profile, inventoryProfile });
			this.markDirty(profileKey);
		}
		return true;
	}

	public save(profileKey: string): RepositoryResult<void> {
		const profile = this.profiles.get(profileKey);
		if (profile === undefined) {
			return { ok: false, error: `Profile '${profileKey}' is not loaded.`, retryable: false };
		}
		if (this.closingProfiles.has(profileKey)) {
			return { ok: false, error: `Profile '${profileKey}' is closing.`, retryable: false };
		}
		const quarantineReason = this.quarantinedProfiles.get(profileKey);
		if (quarantineReason !== undefined) {
			return { ok: false, error: quarantineReason, retryable: false, kind: "OwnershipLost" };
		}
		const generation = this.profileGenerations.get(profileKey) ?? 0;
		const dirty = generation !== (this.persistedGenerations.get(profileKey) ?? -1);
		const result = dirty ? this.store.save(profileKey, profile) : this.store.renew(profileKey);
		if (result.ok && dirty) this.persistedGenerations.set(profileKey, generation);
		if (!result.ok && result.kind === "OwnershipLost") this.quarantine(profileKey, result.error);
		return result;
	}

	public unload(profileKey: string): RepositoryResult<void> {
		const profile = this.profiles.get(profileKey);
		if (profile === undefined)
			return { ok: false, error: `Profile '${profileKey}' is not loaded.`, retryable: false };
		const quarantineReason = this.quarantinedProfiles.get(profileKey);
		if (quarantineReason !== undefined) {
			return { ok: false, error: quarantineReason, retryable: false, kind: "OwnershipLost" };
		}
		this.closingProfiles.add(profileKey);
		const result = this.store.release(profileKey, profile);
		if (result.ok) {
			this.profiles.delete(profileKey);
			this.closingProfiles.delete(profileKey);
			this.profileGenerations.delete(profileKey);
			this.persistedGenerations.delete(profileKey);
		} else if (result.kind === "OwnershipLost") {
			this.closingProfiles.delete(profileKey);
			this.quarantine(profileKey, result.error);
		}
		return result;
	}

	private quarantine(profileKey: string, errorMessage: string): void {
		this.quarantinedProfiles.set(
			profileKey,
			`Profile '${profileKey}' is quarantined after database ownership was lost: ${errorMessage}`,
		);
	}

	private markDirty(profileKey: string): void {
		this.profileGenerations.set(profileKey, (this.profileGenerations.get(profileKey) ?? 0) + 1);
	}

	private failLoadedProfile(profileKey: string, errorMessage: string): PlayerProfileLoadResult {
		const abandoned = this.store.abandon(profileKey);
		return {
			ok: false,
			error: abandoned.ok ? errorMessage : `${errorMessage} Session cleanup also failed: ${abandoned.error}`,
		};
	}
}
