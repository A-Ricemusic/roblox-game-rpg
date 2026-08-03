import { describe, expect, it } from "@rbxts/jest-globals";

import { parseInventoryClientRequest, parseInventoryServerMessage } from "./InventoryRemoteProtocol";

describe("InventoryRemoteProtocol", () => {
	it("accepts snapshot and constrained equipment intents", () => {
		expect(parseInventoryClientRequest({ kind: "RequestSnapshot" })).toEqual({ kind: "RequestSnapshot" });
		expect(parseInventoryClientRequest({ kind: "SetWeaponEquipped", itemId: "hoplite_sword" })).toEqual({
			kind: "SetWeaponEquipped",
			itemId: "hoplite_sword",
		});
		expect(parseInventoryClientRequest({ kind: "SetWeaponEquipped" })).toEqual({ kind: "SetWeaponEquipped" });
		expect(parseInventoryClientRequest({ kind: "RequestSnapshot", itemId: "hoplite_sword" })).toBeUndefined();
		expect(
			parseInventoryClientRequest({ kind: "SetWeaponEquipped", itemId: "hoplite_sword", quantity: 999 }),
		).toBeUndefined();
		expect(
			parseInventoryClientRequest({ kind: "SetWeaponEquipped", itemId: string.rep("x", 129) }),
		).toBeUndefined();
		expect(parseInventoryClientRequest({ kind: "GrantItem", itemId: "marble_fragment" })).toBeUndefined();
	});

	it("rejects impossible snapshot counters and oversized item arrays", () => {
		const item = {
			itemId: "marble_fragment",
			displayName: "Marble Fragment",
			description: "Ancient stone.",
			category: "Material",
			quantity: 1,
			equipped: false,
		};
		expect(
			parseInventoryServerMessage({ kind: "Snapshot", items: [item], occupiedSlots: 0, maximumSlots: 200 }),
		).toBeUndefined();
		expect(
			parseInventoryServerMessage({ kind: "Snapshot", items: [], occupiedSlots: -1, maximumSlots: 200 }),
		).toBeUndefined();
		expect(
			parseInventoryServerMessage({ kind: "Snapshot", items: [], occupiedSlots: 0, maximumSlots: 201 }),
		).toBeUndefined();
		expect(
			parseInventoryServerMessage({
				kind: "Snapshot",
				items: { named: item },
				occupiedSlots: 0,
				maximumSlots: 200,
			}),
		).toBeUndefined();
	});
});
