import { describe, expect, it } from "@rbxts/jest-globals";

import { createInitialInventoryProfile } from "shared/inventory/InventoryEngine";

import { createTestPlayerServices } from "./testing/createTestPlayerServices";

describe("PlayerProfileService", () => {
	it("abandons repository state when a load cannot complete safely", () => {
		const services = createTestPlayerServices();
		services.repository.queueLoadResult({ ok: false, error: "invalid profile", retryable: false });
		const result = services.playerProfiles.load("player:invalid");
		expect(result.ok).toBe(false);
		expect(services.repository.abandonCalls).toBe(1);
	});

	it("blocks mutations while release is uncertain and permits a later release retry", () => {
		const services = createTestPlayerServices();
		expect(services.playerProfiles.load("player:closing").ok).toBe(true);
		services.repository.queueReleaseResult({ ok: false, error: "timeout", retryable: true });
		services.repository.queueReleaseResult({ ok: false, error: "timeout", retryable: true });
		const failedRelease = services.playerProfiles.unload("player:closing");
		expect(failedRelease.ok).toBe(false);
		expect(services.playerProfiles.isClosing("player:closing")).toBe(true);
		expect(services.playerProfiles.updateInventoryProfile("player:closing", createInitialInventoryProfile())).toBe(
			false,
		);
		expect(
			services.inventories.claimWorldPickup("player:closing", {
				pickupId: "closing:pickup",
				itemId: "marble_fragment",
				quantity: 1,
			}),
		).toBeUndefined();
		expect(services.playerProfiles.save("player:closing").ok).toBe(false);
		expect(services.playerProfiles.unload("player:closing").ok).toBe(true);
		expect(services.playerProfiles.get("player:closing")).toBeUndefined();
	});

	it("quarantines a loaded profile immediately after database ownership loss", () => {
		const services = createTestPlayerServices();
		expect(services.playerProfiles.load("player:lost").ok).toBe(true);
		services.repository.queueSaveResult({
			ok: false,
			error: "session superseded",
			retryable: false,
			kind: "OwnershipLost",
		});
		const result = services.playerProfiles.save("player:lost");
		expect(result.ok).toBe(false);
		expect(services.playerProfiles.getQuarantineReason("player:lost")).toBeDefined();
		expect(
			services.inventories.claimWorldPickup("player:lost", {
				pickupId: "lost:pickup",
				itemId: "marble_fragment",
				quantity: 1,
			}),
		).toBeUndefined();
	});

	it("writes dirty profiles and uses lightweight lease renewal while clean", () => {
		const services = createTestPlayerServices();
		expect(services.playerProfiles.load("player:renew").ok).toBe(true);
		expect(services.playerProfiles.save("player:renew").ok).toBe(true);
		expect(services.repository.saveCalls).toBe(1);
		expect(services.playerProfiles.save("player:renew").ok).toBe(true);
		expect(services.repository.saveCalls).toBe(1);
		expect(services.repository.renewCalls).toBe(1);
		expect(
			services.inventories.claimWorldPickup("player:renew", {
				pickupId: "renew:dirty",
				itemId: "marble_fragment",
				quantity: 1,
			})?.ok,
		).toBe(true);
		expect(services.playerProfiles.save("player:renew").ok).toBe(true);
		expect(services.repository.saveCalls).toBe(2);
	});

	it("marks equipment changes dirty and preserves explicit unequipped state after reconnect", () => {
		const services = createTestPlayerServices();
		expect(services.playerProfiles.load("player:equipment").ok).toBe(true);
		expect(services.playerProfiles.save("player:equipment").ok).toBe(true);
		expect(services.repository.saveCalls).toBe(1);

		const unequipped = services.inventories.setEquippedWeapon("player:equipment", undefined);
		expect(unequipped?.ok).toBe(true);
		expect(services.playerProfiles.save("player:equipment").ok).toBe(true);
		expect(services.repository.saveCalls).toBe(2);
		const stored = services.repository.getStored("player:equipment") as {
			readonly inventoryProfile: { readonly equipment: { readonly weapon?: string } };
		};
		expect(stored.inventoryProfile.equipment.weapon).toBeUndefined();
		expect(services.playerProfiles.unload("player:equipment").ok).toBe(true);

		const reconnected = createTestPlayerServices(services.repository);
		expect(reconnected.playerProfiles.load("player:equipment").ok).toBe(true);
		expect(reconnected.inventories.get("player:equipment")?.equipment.weapon).toBeUndefined();
	});

	it("keeps a profile dirty when gameplay changes during an in-flight save", () => {
		const services = createTestPlayerServices();
		expect(services.playerProfiles.load("player:concurrent").ok).toBe(true);
		services.repository.beforeSave = () => {
			services.repository.beforeSave = undefined;
			services.inventories.claimWorldPickup("player:concurrent", {
				pickupId: "concurrent:pickup",
				itemId: "marble_fragment",
				quantity: 1,
			});
		};
		expect(services.playerProfiles.save("player:concurrent").ok).toBe(true);
		expect(services.playerProfiles.save("player:concurrent").ok).toBe(true);
		expect(services.repository.saveCalls).toBe(2);
		expect(services.repository.renewCalls).toBe(0);
	});
});
