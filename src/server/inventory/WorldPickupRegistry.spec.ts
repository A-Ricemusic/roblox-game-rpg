import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { CollectionService } from "@rbxts/services";

import { INVENTORY_PICKUP_ATTRIBUTES, INVENTORY_PICKUP_TAG } from "./WorldPickupMetadata";
import { RobloxInventoryPickupTagSource, WorldPickupRegistry } from "./WorldPickupRegistry";

const instances = new Array<Instance>();
const registries = new Array<WorldPickupRegistry>();

function createPickup(pickupId: string, itemId = "marble_fragment"): BasePart {
	const part = new Instance("Part");
	instances.push(part);
	part.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.pickupId, pickupId);
	part.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.itemId, itemId);
	return part;
}

afterEach(() => {
	for (const registry of registries) registry.stop();
	registries.clear();
	for (const instance of instances) {
		if (CollectionService.HasTag(instance, INVENTORY_PICKUP_TAG)) {
			CollectionService.RemoveTag(instance, INVENTORY_PICKUP_TAG);
		}
		instance.Destroy();
	}
	instances.clear();
});

describe("WorldPickupRegistry", () => {
	it("registers existing and added tags, finds descendants, and removes entries", () => {
		const existing = createPickup("ruins:marble:existing");
		CollectionService.AddTag(existing, INVENTORY_PICKUP_TAG);
		const registry = new WorldPickupRegistry(new RobloxInventoryPickupTagSource());
		registries.push(registry);
		registry.start();
		expect(registry.get(existing)?.itemId).toBe("marble_fragment");

		const added = createPickup("ruins:marble:added");
		const prompt = new Instance("ProximityPrompt");
		instances.push(prompt);
		prompt.Parent = added;
		CollectionService.AddTag(added, INVENTORY_PICKUP_TAG);
		expect(registry.findRegisteredAncestor(prompt)).toBe(added);
		expect(registry.size()).toBe(2);

		CollectionService.RemoveTag(added, INVENTORY_PICKUP_TAG);
		expect(registry.get(added)).toBeUndefined();
	});

	it("reports malformed metadata, unknown items, and duplicate pickup IDs", () => {
		const errors = new Array<string>();
		const registry = new WorldPickupRegistry(
			new RobloxInventoryPickupTagSource(),
			(itemId) => itemId === "marble_fragment",
			(_instance, message) => errors.push(message),
		);
		registries.push(registry);
		registry.start();

		const malformed = new Instance("Part");
		instances.push(malformed);
		CollectionService.AddTag(malformed, INVENTORY_PICKUP_TAG);
		const unknown = createPickup("ruins:unknown", "not_defined");
		CollectionService.AddTag(unknown, INVENTORY_PICKUP_TAG);
		const first = createPickup("ruins:duplicate");
		const duplicate = createPickup("ruins:duplicate");
		CollectionService.AddTag(first, INVENTORY_PICKUP_TAG);
		CollectionService.AddTag(duplicate, INVENTORY_PICKUP_TAG);

		expect(registry.get(malformed)).toBeUndefined();
		expect(registry.get(unknown)).toBeUndefined();
		expect(registry.get(first)).toBeDefined();
		expect(registry.get(duplicate)).toBeUndefined();
		expect(errors).toHaveLength(3);

		CollectionService.RemoveTag(first, INVENTORY_PICKUP_TAG);
		expect(registry.get(duplicate)).toBeDefined();
	});
});
