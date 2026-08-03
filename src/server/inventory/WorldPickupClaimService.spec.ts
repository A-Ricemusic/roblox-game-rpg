import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { CollectionService } from "@rbxts/services";

import { createTestPlayerServices } from "server/player/testing/createTestPlayerServices";

import { INVENTORY_PICKUP_ATTRIBUTES, INVENTORY_PICKUP_TAG } from "./WorldPickupMetadata";
import { WorldPickupClaimService } from "./WorldPickupClaimService";
import { RobloxInventoryPickupTagSource, WorldPickupRegistry } from "./WorldPickupRegistry";

const instances = new Array<Instance>();
const registries = new Array<WorldPickupRegistry>();

function track<T extends Instance>(instance: T): T {
	instances.push(instance);
	return instance;
}

function character(position: Vector3): Model {
	const model = track(new Instance("Model"));
	const root = track(new Instance("Part"));
	root.Name = "HumanoidRootPart";
	root.Position = position;
	root.Parent = model;
	return model;
}

afterEach(() => {
	for (const registry of registries) registry.stop();
	registries.clear();
	for (const instance of instances) {
		if (CollectionService.HasTag(instance, INVENTORY_PICKUP_TAG))
			CollectionService.RemoveTag(instance, INVENTORY_PICKUP_TAG);
		instance.Destroy();
	}
	instances.clear();
});

describe("WorldPickupClaimService", () => {
	it("registers tagged pickups, grants inventory, and rejects repeat collection", () => {
		const services = createTestPlayerServices();
		expect(services.playerProfiles.load("player:1").ok).toBe(true);
		const pickup = track(new Instance("Part"));
		pickup.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.pickupId, "ruins:marble:1");
		pickup.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.itemId, "marble_fragment");
		pickup.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.quantity, 3);
		CollectionService.AddTag(pickup, INVENTORY_PICKUP_TAG);
		const registry = new WorldPickupRegistry(new RobloxInventoryPickupTagSource());
		registries.push(registry);
		registry.start();
		const claims = new WorldPickupClaimService(registry, services.inventories, 12);

		const first = claims.claim("player:1", character(new Vector3(5, 0, 0)), pickup);
		expect(first.ok).toBe(true);
		expect(services.inventories.get("player:1")?.itemQuantities.marble_fragment).toBe(3);
		expect(claims.claim("player:1", character(new Vector3(5, 0, 0)), pickup)).toEqual({
			ok: false,
			reason: "AlreadyClaimed",
		});
	});

	it("rejects unregistered, distant, unknown-item, and unloaded claims", () => {
		const services = createTestPlayerServices();
		const pickup = track(new Instance("Part"));
		pickup.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.pickupId, "unknown:item:1");
		pickup.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.itemId, "not_an_item");
		CollectionService.AddTag(pickup, INVENTORY_PICKUP_TAG);
		const registry = new WorldPickupRegistry(new RobloxInventoryPickupTagSource());
		registries.push(registry);
		registry.start();
		const claims = new WorldPickupClaimService(registry, services.inventories, 12);
		const fake = track(new Instance("Part"));
		expect(claims.claim("player:1", character(new Vector3()), fake)).toEqual({ ok: false, reason: "Unregistered" });
		expect(claims.claim("player:1", character(new Vector3(100, 0, 0)), pickup)).toEqual({
			ok: false,
			reason: "TooFar",
		});
		expect(claims.claim("player:1", character(new Vector3()), pickup)).toEqual({
			ok: false,
			reason: "ProfileNotLoaded",
		});
		services.playerProfiles.load("player:1");
		expect(claims.claim("player:1", character(new Vector3()), pickup)).toEqual({
			ok: false,
			reason: "UnknownItem",
		});
	});

	it("rejects non-finite interaction configuration", () => {
		const services = createTestPlayerServices();
		const registry = new WorldPickupRegistry(new RobloxInventoryPickupTagSource());
		expect(() => new WorldPickupClaimService(registry, services.inventories, math.huge)).toThrow();
	});
});
