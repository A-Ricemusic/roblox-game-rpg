import { decodeInventoryProfile } from "shared/inventory/InventoryProfileCodec";
import { InventoryItemDefinition } from "shared/inventory/InventoryTypes";
import { decodeQuestProfile } from "shared/quests/QuestProfileCodec";

import { PlayerProfile, PLAYER_PROFILE_SCHEMA_VERSION } from "./PlayerProfile";

export type PlayerProfileDecodeResult =
	{ readonly ok: true; readonly profile: PlayerProfile } | { readonly ok: false; readonly error: string };

export function decodePlayerProfile(
	value: unknown,
	inventoryDefinitions: ReadonlyArray<InventoryItemDefinition>,
): PlayerProfileDecodeResult {
	if (value !== undefined && typeIs(value, "table")) {
		const record = value as Readonly<Record<string, unknown>>;
		if (record.questProfile !== undefined || record.inventoryProfile !== undefined) {
			if (record.schemaVersion !== PLAYER_PROFILE_SCHEMA_VERSION) {
				return { ok: false, error: `Unsupported player profile schema version '${record.schemaVersion}'.` };
			}
			const quest = decodeQuestProfile(record.questProfile);
			if (!quest.ok) return quest;
			const inventory = decodeInventoryProfile(record.inventoryProfile, inventoryDefinitions);
			if (!inventory.ok) return inventory;
			return {
				ok: true,
				profile: {
					schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
					questProfile: quest.profile,
					inventoryProfile: inventory.profile,
				},
			};
		}
	}

	// Existing DataStore and pre-inventory Convex values are quest-profile shaped.
	const quest = decodeQuestProfile(value);
	if (!quest.ok) return quest;
	const inventory = decodeInventoryProfile(undefined, inventoryDefinitions);
	return {
		ok: true,
		profile: {
			schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
			questProfile: quest.profile,
			inventoryProfile: inventory.ok ? inventory.profile : error("Unable to create an empty inventory profile."),
		},
	};
}
