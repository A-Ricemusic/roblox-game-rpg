import { describe, expect, it } from "@rbxts/jest-globals";

import { QUEST_DEFINITIONS } from "./QuestDefinitions";
import { createEmptyQuestProfile, startAutoQuests } from "./QuestEngine";
import { buildQuestClientViews } from "./QuestViewModel";

describe("QuestViewModel", () => {
	it("builds a display-safe snapshot from active quest state", () => {
		const profile = startAutoQuests(createEmptyQuestProfile(), QUEST_DEFINITIONS);

		const views = buildQuestClientViews(profile, QUEST_DEFINITIONS);

		expect(views).toHaveLength(1);
		expect(views[0].title).toBe("The First Harvest");
		expect(views[0].summary).toContain("olive branches");
		expect(views[0].status).toBe("Active");
		expect(views[0].objectives[0].progress).toBe(0);
		expect(views[0].objectives[0].required).toBe(3);
	});

	it("adds completed tracked quests to the sanitized journal", () => {
		const profile = {
			...createEmptyQuestProfile(),
			completedQuestIds: [QUEST_DEFINITIONS[0].id],
		};
		const views = buildQuestClientViews(profile, QUEST_DEFINITIONS);
		expect(views).toHaveLength(1);
		expect(views[0].status).toBe("Completed");
		expect(views[0].objectives).toHaveLength(0);
		expect(views[0].stageTitle).toBe("Journey complete");
	});

	it("does not expose active state whose definition is unavailable", () => {
		const profile = startAutoQuests(createEmptyQuestProfile(), QUEST_DEFINITIONS);
		expect(buildQuestClientViews(profile, [])).toHaveLength(0);
	});
});
