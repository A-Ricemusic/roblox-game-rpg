import { describe, expect, it } from "@rbxts/jest-globals";

import { INVENTORY_ITEM_DEFINITIONS } from "./InventoryDefinitions";
import { decodeInventoryProfile } from "./InventoryProfileCodec";

describe("InventoryProfileCodec", () => {
	it("creates empty state and accepts known bounded stacks", () => {
		expect(decodeInventoryProfile(undefined, INVENTORY_ITEM_DEFINITIONS).ok).toBe(true);
		const result = decodeInventoryProfile(
			{
				schemaVersion: 1,
				itemQuantities: { marble_fragment: 7 },
				claimedWorldPickupIds: ["ruins:marble:1"],
			},
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(result.ok).toBe(true);
	});

	it("rejects unknown items, excess stacks, and duplicate pickup IDs", () => {
		expect(
			decodeInventoryProfile(
				{ schemaVersion: 1, itemQuantities: { weapon_sword: 1 }, claimedWorldPickupIds: [] },
				INVENTORY_ITEM_DEFINITIONS,
			).ok,
		).toBe(false);
		expect(
			decodeInventoryProfile(
				{ schemaVersion: 1, itemQuantities: { ambrosia_vial: 21 }, claimedWorldPickupIds: [] },
				INVENTORY_ITEM_DEFINITIONS,
			).ok,
		).toBe(false);
		expect(
			decodeInventoryProfile(
				{ schemaVersion: 1, itemQuantities: {}, claimedWorldPickupIds: ["same", "same"] },
				INVENTORY_ITEM_DEFINITIONS,
			).ok,
		).toBe(false);
	});
});
