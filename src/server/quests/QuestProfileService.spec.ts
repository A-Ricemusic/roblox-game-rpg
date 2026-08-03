import { describe, expect, it } from "@rbxts/jest-globals";

import { QUEST_DEFINITIONS, SACRED_OLIVE_BRANCH_ITEM_ID } from "shared/quests/QuestDefinitions";
import { PlayerProfile } from "shared/player/PlayerProfile";

import { FakePlayerProfileRepository } from "server/player/testing/FakePlayerProfileRepository";
import { createTestPlayerServices } from "server/player/testing/createTestPlayerServices";

describe("Player and quest profile services", () => {
	it("loads legacy quest data, starts auto quests, and saves an aggregate player profile", () => {
		const services = createTestPlayerServices();
		const loaded = services.playerProfiles.load("player:1", 100);
		expect(loaded.ok).toBe(true);
		const questId = QUEST_DEFINITIONS[0].id;
		expect(services.quests.get("player:1")?.activeQuests[questId]).toBeDefined();

		const update = services.quests.applyCollectible("player:1", {
			kind: "CollectibleAcquired",
			itemId: SACRED_OLIVE_BRANCH_ITEM_ID,
			quantity: 1,
			source: "WorldTag",
			sourceId: "olive:1",
		});
		expect(update?.changes).toHaveLength(1);
		expect(services.playerProfiles.save("player:1").ok).toBe(true);
		const stored = services.repository.getStored("player:1") as PlayerProfile;
		expect(stored.questProfile).toBe(update?.profile);
		expect(stored.inventoryProfile.itemQuantities).toEqual({ hoplite_sword: 1 });
		expect(stored.inventoryProfile.equipment.weapon).toBe("hoplite_sword");
	});

	it("does not unload when the aggregate release ultimately fails", () => {
		const repository = new FakePlayerProfileRepository();
		const services = createTestPlayerServices(repository);
		expect(services.playerProfiles.load("player:2").ok).toBe(true);
		repository.queueReleaseResult({ ok: false, error: "throttled", retryable: true });
		repository.queueReleaseResult({ ok: false, error: "still throttled", retryable: true });
		expect(services.playerProfiles.unload("player:2").ok).toBe(false);
		expect(services.playerProfiles.get("player:2")).toBeDefined();
	});

	it("abandons the acquired session when persisted data is malformed", () => {
		const repository = new FakePlayerProfileRepository();
		repository.seed("player:3", { schemaVersion: 999 });
		const result = createTestPlayerServices(repository).playerProfiles.load("player:3");
		expect(result.ok).toBe(false);
		expect(repository.abandonCalls).toBe(1);
	});

	it("rejects incompatible active stages and abandons the session", () => {
		const repository = new FakePlayerProfileRepository();
		const definition = QUEST_DEFINITIONS[0];
		repository.seed("player:invalid-stage", {
			schemaVersion: 1,
			activeQuests: {
				[definition.id]: {
					questId: definition.id,
					definitionVersion: definition.version,
					status: "Active",
					currentStageIndex: 999,
					objectiveProgress: {},
					startedAt: 1,
					updatedAt: 1,
				},
			},
			completedQuestIds: [],
		});
		expect(createTestPlayerServices(repository).playerProfiles.load("player:invalid-stage").ok).toBe(false);
		expect(repository.abandonCalls).toBe(1);
	});

	it("returns the already loaded aggregate without a stale repository reload", () => {
		const services = createTestPlayerServices();
		expect(services.playerProfiles.load("player:4").ok).toBe(true);
		services.quests.applyCollectible("player:4", {
			kind: "CollectibleAcquired",
			itemId: SACRED_OLIVE_BRANCH_ITEM_ID,
			quantity: 1,
			source: "WorldTag",
			sourceId: "olive:4",
		});
		const current = services.playerProfiles.get("player:4");
		const loadedAgain = services.playerProfiles.load("player:4");
		expect(loadedAgain.ok).toBe(true);
		if (loadedAgain.ok) expect(loadedAgain.profile).toBe(current);
		expect(services.repository.loadCalls).toBe(1);
	});
});
