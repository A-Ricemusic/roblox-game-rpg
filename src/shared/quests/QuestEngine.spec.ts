import { describe, expect, it } from "@rbxts/jest-globals";

import { applyCollectibleAcquired, createEmptyQuestProfile, startAutoQuests } from "./QuestEngine";
import { QuestDefinition, QuestProfile } from "./QuestTypes";

function makeQuest(id: string, itemId: string, required: number, stageCount = 1): QuestDefinition {
	const stages = new Array<QuestDefinition["stages"][number]>();
	for (let index = 0; index < stageCount; index++) {
		stages.push({
			id: `stage_${index}`,
			title: `Stage ${index}`,
			objectives: [
				{
					id: `collect_${index}`,
					kind: "CollectItem",
					description: `Collect ${itemId}`,
					itemId,
					required,
					allowedSources: ["WorldTag"],
				},
			],
		});
	}
	return { id, version: 1, title: id, summary: id, autoStart: true, stages };
}

function collect(
	profile: QuestProfile,
	definitions: ReadonlyArray<QuestDefinition>,
	itemId: string,
	sourceId: string,
	quantity = 1,
) {
	return applyCollectibleAcquired(
		profile,
		definitions,
		{ kind: "CollectibleAcquired", itemId, quantity, source: "WorldTag", sourceId },
		100,
	);
}

describe("QuestEngine collection objectives", () => {
	it("auto-starts eligible quests once", () => {
		const definition = makeQuest("olive_quest", "olive", 3);
		const started = startAutoQuests(createEmptyQuestProfile(), [definition], 10);
		const startedAgain = startAutoQuests(started, [definition], 20);

		expect(started.activeQuests[definition.id]).toBeDefined();
		expect(startedAgain).toBe(started);
	});

	it("matches item collections and ignores unrelated events", () => {
		const definition = makeQuest("olive_quest", "olive", 3);
		const profile = startAutoQuests(createEmptyQuestProfile(), [definition]);
		const wrong = collect(profile, [definition], "laurel", "laurel_1");
		const matched = collect(profile, [definition], "olive", "olive_1");

		expect(wrong.profile).toBe(profile);
		expect(wrong.changes).toHaveLength(0);
		expect(matched.changes).toHaveLength(1);
		expect(matched.changes[0].progress).toBe(1);
	});

	it("deduplicates collectible IDs and caps progress", () => {
		const definition = makeQuest("olive_quest", "olive", 3);
		const started = startAutoQuests(createEmptyQuestProfile(), [definition]);
		const first = collect(started, [definition], "olive", "olive_1", 2);
		const duplicate = collect(first.profile, [definition], "olive", "olive_1", 2);
		const capped = collect(duplicate.profile, [definition], "olive", "olive_2", 10);

		expect(duplicate.profile).toBe(first.profile);
		expect(duplicate.changes).toHaveLength(0);
		expect(capped.changes[0].progress).toBe(3);
		expect(capped.changes[0].questCompleted).toBe(true);
		expect(capped.profile.completedQuestIds).toContain(definition.id);
		expect(capped.profile.activeQuests[definition.id]).toBeUndefined();
	});

	it("does not spill a stage-completing event into the next stage", () => {
		const definition = makeQuest("two_stage_quest", "olive", 1, 2);
		const started = startAutoQuests(createEmptyQuestProfile(), [definition]);
		const stageOne = collect(started, [definition], "olive", "olive_1");
		const active = stageOne.profile.activeQuests[definition.id];

		expect(active.currentStageIndex).toBe(1);
		expect(active.objectiveProgress.collect_1.progress).toBe(0);
		expect(stageOne.profile.completedQuestIds.includes(definition.id)).toBe(false);
	});

	it("updates multiple simultaneous matching quests independently", () => {
		const first = makeQuest("first", "olive", 1);
		const second = makeQuest("second", "olive", 2);
		const started = startAutoQuests(createEmptyQuestProfile(), [first, second]);
		const result = collect(started, [first, second], "olive", "shared_olive");

		expect(result.changes).toHaveLength(2);
		expect(result.profile.completedQuestIds).toContain("first");
		expect(result.profile.activeQuests.second.objectiveProgress.collect_0.progress).toBe(1);
	});

	it("keeps different players isolated", () => {
		const definition = makeQuest("olive_quest", "olive", 2);
		const playerOne = startAutoQuests(createEmptyQuestProfile(), [definition]);
		const playerTwo = startAutoQuests(createEmptyQuestProfile(), [definition]);
		const updatedOne = collect(playerOne, [definition], "olive", "olive_1").profile;

		expect(updatedOne.activeQuests.olive_quest.objectiveProgress.collect_0.progress).toBe(1);
		expect(playerTwo.activeQuests.olive_quest.objectiveProgress.collect_0.progress).toBe(0);
	});
});
