import { describe, expect, it } from "@rbxts/jest-globals";
import { HttpService } from "@rbxts/services";

import { INVENTORY_ITEM_DEFINITIONS } from "./InventoryDefinitions";
import { decodeInventoryProfile } from "./InventoryProfileCodec";
import { InventoryItemDefinition, MAX_INVENTORY_ITEM_TYPES } from "./InventoryTypes";

describe("InventoryProfileCodec", () => {
	it("creates empty state and accepts known bounded stacks", () => {
		const initial = decodeInventoryProfile(undefined, INVENTORY_ITEM_DEFINITIONS);
		expect(initial.ok).toBe(true);
		if (initial.ok) {
			expect(initial.profile.itemQuantities.hoplite_sword).toBe(1);
			expect(initial.profile.equipment.weapon).toBe("hoplite_sword");
		}
		const result = decodeInventoryProfile(
			{
				schemaVersion: 1,
				itemQuantities: { marble_fragment: 7 },
				claimedWorldPickupIds: ["ruins:marble:1"],
			},
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.profile.itemQuantities.hoplite_sword).toBe(1);
			expect(result.profile.equipment.weapon).toBe("hoplite_sword");
		}
	});

	it("preserves explicit unequipped state and encodes it as a JSON object", () => {
		const result = decodeInventoryProfile(
			{
				schemaVersion: 1,
				itemQuantities: { hoplite_sword: 1 },
				claimedWorldPickupIds: [],
				equipment: { schemaVersion: 1 },
			},
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.profile.equipment.weapon).toBeUndefined();
		const encoded = HttpService.JSONEncode(result.profile.equipment);
		expect(encoded.sub(1, 1)).toBe("{");
		expect(encoded).toContain("schemaVersion");
	});

	it("rejects equipment that is unknown or not a weapon", () => {
		for (const equipment of [
			{ schemaVersion: 1, weapon: "not_registered" },
			{ schemaVersion: 1, weapon: "marble_fragment" },
		]) {
			expect(
				decodeInventoryProfile(
					{ schemaVersion: 1, itemQuantities: { marble_fragment: 1 }, claimedWorldPickupIds: [], equipment },
					INVENTORY_ITEM_DEFINITIONS,
				).ok,
			).toBe(false);
		}
	});

	it("keeps a full legacy inventory usable when the additive starter grant has no free slot", () => {
		const definitions = new Array<InventoryItemDefinition>();
		for (const definition of INVENTORY_ITEM_DEFINITIONS) definitions.push(definition);
		const itemQuantities: Record<string, number> = {};
		for (let index = 0; index < MAX_INVENTORY_ITEM_TYPES; index++) {
			const id = `legacy_item_${index}`;
			definitions.push({
				id,
				displayName: id,
				description: "Legacy item",
				category: "Miscellaneous",
				maxStack: 1,
				canDrop: false,
			});
			itemQuantities[id] = 1;
		}
		const result = decodeInventoryProfile(
			{ schemaVersion: 1, itemQuantities, claimedWorldPickupIds: [] },
			definitions,
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.profile.itemQuantities.hoplite_sword).toBeUndefined();
			expect(result.profile.equipment.weapon).toBeUndefined();
		}
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

	it("rejects dictionary-shaped and sparse pickup tables", () => {
		expect(
			decodeInventoryProfile(
				{ schemaVersion: 1, itemQuantities: {}, claimedWorldPickupIds: { named: "pickup:1" } },
				INVENTORY_ITEM_DEFINITIONS,
			).ok,
		).toBe(false);
		const sparse = {} as Record<number, string>;
		sparse[2] = "pickup:2";
		expect(
			decodeInventoryProfile(
				{ schemaVersion: 1, itemQuantities: {}, claimedWorldPickupIds: sparse },
				INVENTORY_ITEM_DEFINITIONS,
			).ok,
		).toBe(false);
	});

	it("rejects pickup IDs that Convex cannot persist", () => {
		expect(
			decodeInventoryProfile(
				{
					schemaVersion: 1,
					itemQuantities: {},
					claimedWorldPickupIds: [string.rep("p", 116)],
				},
				INVENTORY_ITEM_DEFINITIONS,
			).ok,
		).toBe(false);
	});
});
