import { describe, expect, it } from "@rbxts/jest-globals";

import { INVENTORY_ITEM_DEFINITIONS } from "shared/inventory/InventoryDefinitions";

import { decodePlayerProfile } from "./PlayerProfileCodec";

describe("PlayerProfileCodec", () => {
	it("migrates a legacy quest-only profile with an empty inventory", () => {
		const result = decodePlayerProfile(
			{ schemaVersion: 1, activeQuests: {}, completedQuestIds: [] },
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.profile.inventoryProfile.itemQuantities).toEqual({});
	});

	it("decodes aggregate profiles and rejects a malformed inventory domain", () => {
		const valid = decodePlayerProfile(
			{
				schemaVersion: 1,
				questProfile: { schemaVersion: 1, activeQuests: {}, completedQuestIds: [] },
				inventoryProfile: {
					schemaVersion: 1,
					itemQuantities: { marble_fragment: 2 },
					claimedWorldPickupIds: ["marble:1"],
				},
			},
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(valid.ok).toBe(true);
		const invalid = decodePlayerProfile(
			{
				schemaVersion: 1,
				questProfile: { schemaVersion: 1, activeQuests: {}, completedQuestIds: [] },
				inventoryProfile: { schemaVersion: 9 },
			},
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(invalid.ok).toBe(false);
	});
});
