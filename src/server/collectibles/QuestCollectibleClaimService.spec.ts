import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { CollectionService } from "@rbxts/services";

import { QUEST_DEFINITIONS, SACRED_OLIVE_BRANCH_ITEM_ID } from "shared/quests/QuestDefinitions";

import { QuestProfileService } from "server/quests/QuestProfileService";
import { ResilientQuestProfileStore } from "server/quests/persistence/ResilientQuestProfileStore";
import { FakeQuestProfileRepository } from "server/quests/testing/FakeQuestProfileRepository";

import { QUEST_COLLECTIBLE_ATTRIBUTES, QUEST_COLLECTIBLE_TAG } from "./CollectibleMetadata";
import { CollectibleRegistry, RobloxCollectionTagSource } from "./CollectibleRegistry";
import { QuestCollectibleClaimService } from "./QuestCollectibleClaimService";

const instances = new Array<Instance>();
const registries = new Array<CollectibleRegistry>();

function track<T extends Instance>(instance: T): T {
	instances.push(instance);
	return instance;
}

function createCharacter(position: Vector3): Model {
	const character = track(new Instance("Model"));
	const root = track(new Instance("Part"));
	root.Name = "HumanoidRootPart";
	root.Position = position;
	root.Parent = character;
	return character;
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

describe("QuestCollectibleClaimService", () => {
	it("rejects an unbounded interaction distance", () => {
		const repository = new FakeQuestProfileRepository();
		const profiles = new QuestProfileService(
			new ResilientQuestProfileStore(repository, { maxAttempts: 1, baseDelaySeconds: 0, maxDelaySeconds: 0 }),
			QUEST_DEFINITIONS,
		);
		const registry = new CollectibleRegistry(new RobloxCollectionTagSource());
		expect(() => new QuestCollectibleClaimService(registry, profiles, math.huge)).toThrow();
	});

	it("derives item data on the server and deduplicates repeat claims", () => {
		const repository = new FakeQuestProfileRepository();
		const profiles = new QuestProfileService(
			new ResilientQuestProfileStore(repository, { maxAttempts: 1, baseDelaySeconds: 0, maxDelaySeconds: 0 }),
			QUEST_DEFINITIONS,
		);
		expect(profiles.load("player:1").ok).toBe(true);

		const collectible = track(new Instance("Part"));
		collectible.Position = new Vector3(0, 0, 0);
		collectible.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.collectibleId, "olive:secure");
		collectible.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.itemId, SACRED_OLIVE_BRANCH_ITEM_ID);
		collectible.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.quantity, 2);
		CollectionService.AddTag(collectible, QUEST_COLLECTIBLE_TAG);

		const registry = new CollectibleRegistry(new RobloxCollectionTagSource());
		registries.push(registry);
		registry.start();
		const claims = new QuestCollectibleClaimService(registry, profiles, 12);
		const character = createCharacter(new Vector3(5, 0, 0));

		const first = claims.claim("player:1", character, collectible, 100);
		const duplicate = claims.claim("player:1", character, collectible, 101);

		expect(first.ok).toBe(true);
		if (first.ok) expect(first.questResult.changes[0].progress).toBe(2);
		expect(duplicate.ok).toBe(true);
		if (duplicate.ok) expect(duplicate.questResult.changes).toHaveLength(0);
	});

	it("rejects unregistered instances, distant characters, and unloaded profiles", () => {
		const repository = new FakeQuestProfileRepository();
		const profiles = new QuestProfileService(
			new ResilientQuestProfileStore(repository, { maxAttempts: 1, baseDelaySeconds: 0, maxDelaySeconds: 0 }),
			QUEST_DEFINITIONS,
		);
		const collectible = track(new Instance("Part"));
		collectible.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.collectibleId, "olive:guarded");
		collectible.SetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.itemId, SACRED_OLIVE_BRANCH_ITEM_ID);
		CollectionService.AddTag(collectible, QUEST_COLLECTIBLE_TAG);

		const registry = new CollectibleRegistry(new RobloxCollectionTagSource());
		registries.push(registry);
		registry.start();
		const claims = new QuestCollectibleClaimService(registry, profiles, 12);

		const fake = track(new Instance("Part"));
		const nearby = createCharacter(new Vector3(0, 0, 0));
		const distant = createCharacter(new Vector3(100, 0, 0));
		expect(claims.claim("player:1", nearby, fake)).toEqual({ ok: false, reason: "Unregistered" });
		expect(claims.claim("player:1", distant, collectible)).toEqual({ ok: false, reason: "TooFar" });
		expect(claims.claim("player:1", nearby, collectible)).toEqual({ ok: false, reason: "ProfileNotLoaded" });
	});
});
