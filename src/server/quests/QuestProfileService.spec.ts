import { describe, expect, it } from "@rbxts/jest-globals";

import { QUEST_DEFINITIONS, SACRED_OLIVE_BRANCH_ITEM_ID } from "shared/quests/QuestDefinitions";

import { ResilientQuestProfileStore } from "./persistence/ResilientQuestProfileStore";
import { FakeQuestProfileRepository } from "./testing/FakeQuestProfileRepository";
import { QuestProfileService } from "./QuestProfileService";

function createService(repository: FakeQuestProfileRepository): QuestProfileService {
	return new QuestProfileService(
		new ResilientQuestProfileStore(
			repository,
			{ maxAttempts: 2, baseDelaySeconds: 0, maxDelaySeconds: 0 },
			() => undefined,
		),
		QUEST_DEFINITIONS,
	);
}

describe("QuestProfileService", () => {
	it("loads a new profile, starts configured quests, and saves collection progress", () => {
		const repository = new FakeQuestProfileRepository();
		const service = createService(repository);
		const loaded = service.load("player:1", 100);

		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;

		const questId = QUEST_DEFINITIONS[0].id;
		expect(loaded.profile.activeQuests[questId]).toBeDefined();

		const event = {
			kind: "CollectibleAcquired",
			itemId: SACRED_OLIVE_BRANCH_ITEM_ID,
			quantity: 1,
			source: "WorldTag",
			sourceId: "olive:1",
		} as const;
		const update = service.applyCollectible("player:1", event, 101);
		expect(update?.changes).toHaveLength(1);
		expect(service.save("player:1").ok).toBe(true);
		expect(repository.getStored("player:1")).toEqual(update?.profile);
	});

	it("does not unload a profile when saving ultimately fails", () => {
		const repository = new FakeQuestProfileRepository();
		const service = createService(repository);
		expect(service.load("player:2").ok).toBe(true);
		repository.queueSaveResult({ ok: false, error: "throttled", retryable: true });
		repository.queueSaveResult({ ok: false, error: "still throttled", retryable: true });

		const result = service.unload("player:2");

		expect(result.ok).toBe(false);
		expect(service.get("player:2")).toBeDefined();
	});

	it("rejects malformed persisted data instead of silently replacing it", () => {
		const repository = new FakeQuestProfileRepository();
		repository.seed("player:3", { schemaVersion: 999 });

		const result = createService(repository).load("player:3");

		expect(result.ok).toBe(false);
	});

	it("rejects incompatible active stages before they can reach the engine", () => {
		const repository = new FakeQuestProfileRepository();
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

		expect(createService(repository).load("player:invalid-stage").ok).toBe(false);
	});

	it("does not overwrite an already loaded profile with stale repository data", () => {
		const repository = new FakeQuestProfileRepository();
		const service = createService(repository);
		expect(service.load("player:4").ok).toBe(true);

		const update = service.applyCollectible("player:4", {
			kind: "CollectibleAcquired",
			itemId: SACRED_OLIVE_BRANCH_ITEM_ID,
			quantity: 1,
			source: "WorldTag",
			sourceId: "olive:4",
		});
		const loadedAgain = service.load("player:4");

		expect(loadedAgain.ok).toBe(true);
		if (loadedAgain.ok) expect(loadedAgain.profile).toBe(update?.profile);
		expect(repository.loadCalls).toBe(1);
	});
});
