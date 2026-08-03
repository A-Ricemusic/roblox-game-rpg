import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { CollectionService } from "@rbxts/services";

import { QUEST_COLLECTIBLE_ATTRIBUTES, QUEST_COLLECTIBLE_TAG } from "./CollectibleMetadata";
import { CollectibleRegistry, RobloxCollectionTagSource } from "./CollectibleRegistry";

const instances = new Array<Instance>();
const registries = new Array<CollectibleRegistry>();

function createCollectible(collectibleId: string): BasePart {
	const part = new Instance("Part");
	instances.push(part);
	part.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.collectibleId, collectibleId);
	part.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.itemId, "sacred_olive_branch");
	return part;
}

afterEach(() => {
	for (const registry of registries) registry.stop();
	registries.clear();
	for (const instance of instances) {
		if (CollectionService.HasTag(instance, QUEST_COLLECTIBLE_TAG)) {
			CollectionService.RemoveTag(instance, QUEST_COLLECTIBLE_TAG);
		}
		instance.Destroy();
	}
	instances.clear();
});

describe("CollectibleRegistry with CollectionService", () => {
	it("registers existing tags and reacts to tag addition and removal", () => {
		const existing = createCollectible("olive:existing");
		CollectionService.AddTag(existing, QUEST_COLLECTIBLE_TAG);
		const registry = new CollectibleRegistry(new RobloxCollectionTagSource());
		registries.push(registry);
		registry.start();

		expect(registry.get(existing)?.collectibleId).toBe("olive:existing");

		const added = createCollectible("olive:added");
		CollectionService.AddTag(added, QUEST_COLLECTIBLE_TAG);
		expect(registry.get(added)?.itemId).toBe("sacred_olive_branch");
		expect(registry.size()).toBe(2);

		CollectionService.RemoveTag(added, QUEST_COLLECTIBLE_TAG);
		expect(registry.get(added)).toBeUndefined();
		expect(registry.size()).toBe(1);
	});

	it("reports malformed attributes and rejects duplicate stable IDs", () => {
		const errors = new Array<string>();
		const registry = new CollectibleRegistry(new RobloxCollectionTagSource(), (_, message) => errors.push(message));
		registries.push(registry);
		registry.start();

		const malformed = new Instance("Part");
		instances.push(malformed);
		CollectionService.AddTag(malformed, QUEST_COLLECTIBLE_TAG);

		const first = createCollectible("olive:duplicate");
		const duplicate = createCollectible("olive:duplicate");
		CollectionService.AddTag(first, QUEST_COLLECTIBLE_TAG);
		CollectionService.AddTag(duplicate, QUEST_COLLECTIBLE_TAG);

		expect(registry.get(malformed)).toBeUndefined();
		expect(registry.get(first)).toBeDefined();
		expect(registry.get(duplicate)).toBeUndefined();
		expect(errors).toHaveLength(2);
	});

	it("finds a registered collectible from its prompt descendant", () => {
		const collectible = createCollectible("olive:prompt-parent");
		const prompt = new Instance("ProximityPrompt");
		instances.push(prompt);
		prompt.Parent = collectible;
		CollectionService.AddTag(collectible, QUEST_COLLECTIBLE_TAG);

		const registry = new CollectibleRegistry(new RobloxCollectionTagSource());
		registries.push(registry);
		registry.start();

		expect(registry.findRegisteredAncestor(prompt)).toBe(collectible);
	});
});
