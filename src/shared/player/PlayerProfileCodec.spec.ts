import { describe, expect, it } from "@rbxts/jest-globals";

import { INVENTORY_ITEM_DEFINITIONS } from "shared/inventory/InventoryDefinitions";
import { MAX_QUEST_DEFINITIONS } from "shared/quests/QuestProfileLimits";

import { decodePlayerProfile } from "./PlayerProfileCodec";

describe("PlayerProfileCodec", () => {
	it("migrates a legacy quest-only profile with the equipped starter sword", () => {
		const result = decodePlayerProfile(
			{ schemaVersion: 1, activeQuests: {}, completedQuestIds: [] },
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.profile.inventoryProfile.itemQuantities).toEqual({ hoplite_sword: 1 });
			expect(result.profile.inventoryProfile.equipment.weapon).toBe("hoplite_sword");
		}
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

	it("allows an additive missing inventory but rejects an aggregate missing its quest domain", () => {
		const additive = decodePlayerProfile(
			{
				schemaVersion: 1,
				questProfile: { schemaVersion: 1, activeQuests: {}, completedQuestIds: [] },
			},
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(additive.ok).toBe(true);
		const missingQuest = decodePlayerProfile(
			{
				schemaVersion: 1,
				inventoryProfile: { schemaVersion: 1, itemQuantities: {}, claimedWorldPickupIds: [] },
			},
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(missingQuest.ok).toBe(false);
	});

	it("rejects aggregate quest histories that can exceed the player document budget", () => {
		const completedQuestIds = new Array<string>();
		for (let index = 0; index <= MAX_QUEST_DEFINITIONS; index++) completedQuestIds.push(`quest:${index}`);
		expect(
			decodePlayerProfile(
				{
					schemaVersion: 1,
					questProfile: { schemaVersion: 1, activeQuests: {}, completedQuestIds },
					inventoryProfile: { schemaVersion: 1, itemQuantities: {}, claimedWorldPickupIds: [] },
				},
				INVENTORY_ITEM_DEFINITIONS,
			).ok,
		).toBe(false);
	});
});
