import { describe, expect, it } from "@rbxts/jest-globals";

import { decodeQuestProfile } from "./QuestProfileCodec";

describe("QuestProfileCodec", () => {
	it("creates a fresh profile for a new player", () => {
		const result = decodeQuestProfile(undefined);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.profile.schemaVersion).toBe(1);
			expect(result.migrated).toBe(false);
		}
	});

	it("migrates schema zero objective counters", () => {
		const result = decodeQuestProfile({
			schemaVersion: 0,
			activeQuests: {
				olive_quest: {
					questId: "olive_quest",
					definitionVersion: 1,
					currentStageIndex: 0,
					objectiveProgress: { collect_olive: 2 },
					startedAt: 10,
					updatedAt: 20,
				},
			},
			completedQuestIds: [],
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.migrated).toBe(true);
			expect(result.profile.activeQuests.olive_quest.objectiveProgress.collect_olive.progress).toBe(2);
			expect(
				result.profile.activeQuests.olive_quest.objectiveProgress.collect_olive.processedSourceIds,
			).toHaveLength(0);
		}
	});

	it("rejects unknown schema versions and malformed data", () => {
		expect(decodeQuestProfile({ schemaVersion: 99, activeQuests: {}, completedQuestIds: [] }).ok).toBe(false);
		expect(decodeQuestProfile({ schemaVersion: 1, activeQuests: "invalid", completedQuestIds: [] }).ok).toBe(false);
	});

	it("rejects invalid counters, mismatched keys, and duplicate IDs", () => {
		const activeQuest = {
			questId: "olive_quest",
			definitionVersion: 1,
			status: "Active",
			currentStageIndex: 0,
			objectiveProgress: {
				collect_olive: { progress: 1, processedSourceIds: ["olive:1"] },
			},
			startedAt: 10,
			updatedAt: 20,
		};

		expect(
			decodeQuestProfile({
				schemaVersion: 1,
				activeQuests: { wrong_key: activeQuest },
				completedQuestIds: [],
			}).ok,
		).toBe(false);
		expect(
			decodeQuestProfile({
				schemaVersion: 1,
				activeQuests: { olive_quest: { ...activeQuest, currentStageIndex: 0.5 } },
				completedQuestIds: [],
			}).ok,
		).toBe(false);
		expect(
			decodeQuestProfile({
				schemaVersion: 1,
				activeQuests: {},
				completedQuestIds: ["olive_quest", "olive_quest"],
			}).ok,
		).toBe(false);
		expect(
			decodeQuestProfile({
				schemaVersion: 1,
				activeQuests: { olive_quest: activeQuest },
				completedQuestIds: ["olive_quest"],
			}).ok,
		).toBe(false);
	});
});
