import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import {
	getCollectiblePosition,
	isCharacterWithinCollectibleDistance,
	QUEST_COLLECTIBLE_ATTRIBUTES,
	validateCollectibleMetadata,
} from "./CollectibleMetadata";

const instances = new Array<Instance>();

function tracked<T extends Instance>(instance: T): T {
	instances.push(instance);
	return instance;
}

afterEach(() => {
	for (const instance of instances) instance.Destroy();
	instances.clear();
});

describe("CollectibleMetadata", () => {
	it("reads validated attributes and defaults quantity to one", () => {
		const part = tracked(new Instance("Part"));
		part.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.collectibleId, "olive:1");
		part.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.itemId, "sacred_olive_branch");

		const result = validateCollectibleMetadata(part);

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.metadata.quantity).toBe(1);
	});

	it("rejects unsupported instances, missing IDs, and invalid quantities", () => {
		const folder = tracked(new Instance("Folder"));
		expect(validateCollectibleMetadata(folder).ok).toBe(false);

		const part = tracked(new Instance("Part"));
		part.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.collectibleId, "olive:2");
		part.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.itemId, "sacred_olive_branch");
		part.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.quantity, 1.5);
		expect(validateCollectibleMetadata(part).ok).toBe(false);
	});

	it("supports model primary parts and performs server-side distance checks", () => {
		const collectible = tracked(new Instance("Part"));
		collectible.Position = new Vector3(0, 0, 0);
		const model = tracked(new Instance("Model"));
		const primaryPart = tracked(new Instance("Part"));
		primaryPart.Position = new Vector3(5, 0, 0);
		primaryPart.Parent = model;
		model.PrimaryPart = primaryPart;
		expect(getCollectiblePosition(model)).toEqual(primaryPart.Position);

		const character = tracked(new Instance("Model"));
		const root = tracked(new Instance("Part"));
		root.Name = "HumanoidRootPart";
		root.Position = new Vector3(10, 0, 0);
		root.Parent = character;

		expect(isCharacterWithinCollectibleDistance(character, collectible, 10)).toBe(true);
		expect(isCharacterWithinCollectibleDistance(character, collectible, 9.9)).toBe(false);
		expect(isCharacterWithinCollectibleDistance(character, collectible, math.huge)).toBe(false);
	});
});
