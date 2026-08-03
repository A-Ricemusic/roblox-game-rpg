import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import {
	getWorldPickupPosition,
	INVENTORY_PICKUP_ATTRIBUTES,
	isCharacterWithinPickupDistance,
	validateWorldPickupMetadata,
} from "./WorldPickupMetadata";

const instances = new Array<Instance>();

function track<T extends Instance>(instance: T): T {
	instances.push(instance);
	return instance;
}

afterEach(() => {
	for (const instance of instances) instance.Destroy();
	instances.clear();
});

describe("WorldPickupMetadata", () => {
	it("validates stable server-owned attributes and defaults quantity", () => {
		const part = track(new Instance("Part"));
		part.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.pickupId, "grove:olive:1");
		part.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.itemId, "sacred_olive_branch");
		const result = validateWorldPickupMetadata(part);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.metadata.quantity).toBe(1);
	});

	it("rejects unsupported geometry and malformed quantities", () => {
		expect(validateWorldPickupMetadata(track(new Instance("Folder"))).ok).toBe(false);
		const part = track(new Instance("Part"));
		part.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.pickupId, "invalid:quantity");
		part.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.itemId, "marble_fragment");
		part.SetAttribute(INVENTORY_PICKUP_ATTRIBUTES.quantity, 1.5);
		expect(validateWorldPickupMetadata(part).ok).toBe(false);
	});

	it("supports model primary parts and authoritative distance checks", () => {
		const model = track(new Instance("Model"));
		const primary = track(new Instance("Part"));
		primary.Position = new Vector3(0, 0, 0);
		primary.Parent = model;
		model.PrimaryPart = primary;
		expect(getWorldPickupPosition(model)).toEqual(primary.Position);
		const character = track(new Instance("Model"));
		const root = track(new Instance("Part"));
		root.Name = "HumanoidRootPart";
		root.Position = new Vector3(10, 0, 0);
		root.Parent = character;
		expect(isCharacterWithinPickupDistance(character, model, 10)).toBe(true);
		expect(isCharacterWithinPickupDistance(character, model, 9)).toBe(false);
	});
});
