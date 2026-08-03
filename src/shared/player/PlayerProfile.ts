import { createEmptyInventoryProfile } from "shared/inventory/InventoryEngine";
import { InventoryProfile } from "shared/inventory/InventoryTypes";
import { createEmptyQuestProfile } from "shared/quests/QuestEngine";
import { QuestProfile } from "shared/quests/QuestTypes";

export const PLAYER_PROFILE_SCHEMA_VERSION = 1;

export interface PlayerProfile {
	readonly schemaVersion: typeof PLAYER_PROFILE_SCHEMA_VERSION;
	readonly questProfile: QuestProfile;
	readonly inventoryProfile: InventoryProfile;
}

export function createEmptyPlayerProfile(): PlayerProfile {
	return {
		schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
		questProfile: createEmptyQuestProfile(),
		inventoryProfile: createEmptyInventoryProfile(),
	};
}
