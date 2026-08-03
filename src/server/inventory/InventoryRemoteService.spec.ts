import { describe, expect, it } from "@rbxts/jest-globals";

import { INVENTORY_ITEM_DEFINITIONS } from "shared/inventory/InventoryDefinitions";

import { createTestPlayerServices } from "server/player/testing/createTestPlayerServices";

import { InventoryRemoteService } from "./InventoryRemoteService";

describe("InventoryRemoteService", () => {
	it("creates no snapshot for unloaded profiles and rate-limits intent-only requests", () => {
		let now = 10;
		const services = createTestPlayerServices();
		const remote = new Instance("RemoteEvent");
		const service = new InventoryRemoteService(
			remote,
			services.inventories,
			INVENTORY_ITEM_DEFINITIONS,
			undefined,
			() => now,
		);
		expect(services.inventories.get("player:1")).toBeUndefined();
		expect(service.acceptRequest("player:1", { kind: "GrantItem", quantity: 999 })).toBe(false);
		expect(service.acceptRequest("player:1", { kind: "RequestSnapshot" })).toBe(true);
		expect(service.acceptRequest("player:1", { kind: "RequestSnapshot" })).toBe(false);
		expect(service.acceptRequest("player:1", { kind: "SetWeaponEquipped", itemId: "hoplite_sword" })).toBe(true);
		expect(service.acceptRequest("player:1", { kind: "SetWeaponEquipped" })).toBe(false);
		now += 0.25;
		expect(service.acceptRequest("player:1", { kind: "RequestSnapshot" })).toBe(true);
		expect(service.acceptRequest("player:1", { kind: "SetWeaponEquipped" })).toBe(false);
		now += 0.25;
		expect(service.acceptRequest("player:1", { kind: "SetWeaponEquipped" })).toBe(true);
		service.forget("player:1");
		expect(service.acceptRequest("player:1", { kind: "RequestSnapshot" })).toBe(true);
		remote.Destroy();
	});
});
