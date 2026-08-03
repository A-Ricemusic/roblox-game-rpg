import { describe, expect, it } from "@rbxts/jest-globals";

import { INVENTORY_ITEM_DEFINITIONS } from "./InventoryDefinitions";
import { createEmptyInventoryProfile } from "./InventoryEngine";
import { parseInventoryClientRequest, parseInventoryServerMessage } from "./InventoryRemoteProtocol";
import { buildInventorySnapshot } from "./InventoryViewModel";

describe("Inventory protocol and view model", () => {
	it("builds deterministic sanitized snapshots", () => {
		const snapshot = buildInventorySnapshot(
			{
				...createEmptyInventoryProfile(),
				itemQuantities: { sacred_olive_branch: 2, ambrosia_vial: 1 },
			},
			INVENTORY_ITEM_DEFINITIONS,
		);
		expect(snapshot.items).toHaveLength(2);
		expect(snapshot.items[0].displayName).toBe("Sacred Olive Branch");
		expect(parseInventoryServerMessage(snapshot)).toEqual(snapshot);
	});

	it("accepts snapshot intent but rejects client-authored inventory mutations", () => {
		expect(parseInventoryClientRequest({ kind: "RequestSnapshot" })).toEqual({ kind: "RequestSnapshot" });
		expect(
			parseInventoryClientRequest({ kind: "GrantItem", itemId: "ambrosia_vial", quantity: 999 }),
		).toBeUndefined();
		expect(parseInventoryServerMessage({ kind: "Snapshot", items: [{ itemId: 1 }] })).toBeUndefined();
	});
});
