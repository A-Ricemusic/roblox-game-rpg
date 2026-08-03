import { describe, expect, it } from "@rbxts/jest-globals";

import { INVENTORY_ITEM_DEFINITIONS } from "./InventoryDefinitions";
import { createInitialInventoryProfile } from "./InventoryEngine";
import { parseInventoryClientRequest, parseInventoryServerMessage } from "./InventoryRemoteProtocol";
import { buildInventorySnapshot } from "./InventoryViewModel";

describe("Inventory protocol and view model", () => {
	it("builds deterministic sanitized snapshots", () => {
		const snapshot = buildInventorySnapshot(
			{
				...createInitialInventoryProfile(),
				itemQuantities: { hoplite_sword: 1, sacred_olive_branch: 2, ambrosia_vial: 1 },
			},
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(snapshot.items).toHaveLength(3);
		expect(snapshot.items.some((item) => item.itemId === "hoplite_sword" && item.equipped)).toBe(true);
		expect(parseInventoryServerMessage(snapshot)).toEqual(snapshot);
	});

	it("accepts snapshot and equipment intent but rejects client-authored grants", () => {
		expect(parseInventoryClientRequest({ kind: "RequestSnapshot" })).toEqual({ kind: "RequestSnapshot" });
		expect(parseInventoryClientRequest({ kind: "SetWeaponEquipped", itemId: "hoplite_sword" })).toBeDefined();
		expect(
			parseInventoryClientRequest({ kind: "GrantItem", itemId: "ambrosia_vial", quantity: 999 }),
		).toBeUndefined();
		expect(parseInventoryServerMessage({ kind: "Snapshot", items: [{ itemId: 1 }] })).toBeUndefined();
	});
});
