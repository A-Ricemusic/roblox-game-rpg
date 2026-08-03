import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { CollectionService } from "@rbxts/services";

import { createTestPlayerServices } from "server/player/testing/createTestPlayerServices";

import { InventoryPickupCoordinator } from "./InventoryPickupCoordinator";
import { InventoryQuestBridge } from "./InventoryQuestBridge";
import { WorldPickupClaimService } from "./WorldPickupClaimService";
import { INVENTORY_PICKUP_ATTRIBUTES, INVENTORY_PICKUP_TAG } from "./WorldPickupMetadata";
import { RobloxInventoryPickupTagSource, WorldPickupRegistry } from "./WorldPickupRegistry";

const instances = new Array<Instance>();
let registry: WorldPickupRegistry | undefined;

afterEach(() => {
	registry?.stop();
	registry = undefined;
	for (const instance of instances) {
		if (CollectionService.HasTag(instance, INVENTORY_PICKUP_TAG)) {
			CollectionService.RemoveTag(instance, INVENTORY_PICKUP_TAG);
		}
		instance.Destroy();
	}
	instances.clear();
});

describe("InventoryPickupCoordinator", () => {
	it("atomically grants a registered pickup and publishes the resulting quest fact", () => {
		const services = createTestPlayerServices();
		expect(services.playerProfiles.load("player:1", 10).ok).toBe(true);
		const pickup = new Instance("Part");
		instances.push(pickup);
		pickup.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.pickupId, "grove:coordinated:olive");
		pickup.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.itemId, "sacred_olive_branch");
		pickup.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.quantity, 2);
		CollectionService.AddTag(pickup, INVENTORY_PICKUP_TAG);

		const character = new Instance("Model");
		instances.push(character);
		const root = new Instance("Part");
		instances.push(root);
		root.Name = "HumanoidRootPart";
		root.Parent = character;

		registry = new WorldPickupRegistry(new RobloxInventoryPickupTagSource());
		registry.start();
		const coordinator = new InventoryPickupCoordinator(
			new WorldPickupClaimService(registry, services.inventories, 12),
			new InventoryQuestBridge(services.quests),
		);
		const result = coordinator.claim("player:1", character, pickup, 11);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(services.inventories.get("player:1")?.itemQuantities.sacred_olive_branch).toBe(2);
		expect(result.questResult?.changes[0].progress).toBe(2);
	});
});
