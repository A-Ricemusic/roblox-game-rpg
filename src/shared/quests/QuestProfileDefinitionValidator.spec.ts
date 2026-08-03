import { describe, expect, it } from "@rbxts/jest-globals";

import { QUEST_DEFINITIONS } from "./QuestDefinitions";
import { createEmptyQuestProfile, startAutoQuests } from "./QuestEngine";
import { validateQuestProfileAgainstDefinitions } from "./QuestProfileDefinitionValidator";

describe("QuestProfileDefinitionValidator", () => {
	it("accepts state created from installed definitions", () => {
		const profile = startAutoQuests(createEmptyQuestProfile(), QUEST_DEFINITIONS);
		expect(validateQuestProfileAgainstDefinitions(profile, QUEST_DEFINITIONS)).toBeUndefined();
	});

	it("requires explicit migration for incompatible definitions and stages", () => {
		const profile = startAutoQuests(createEmptyQuestProfile(), QUEST_DEFINITIONS);
		const questId = QUEST_DEFINITIONS[0].id;
		const active = profile.activeQuests[questId];
		const wrongVersion = {
			...profile,
			activeQuests: { [questId]: { ...active, definitionVersion: active.definitionVersion + 1 } },
		};
		const wrongStage = {
			...profile,
			activeQuests: { [questId]: { ...active, currentStageIndex: 99 } },
		};

		expect(validateQuestProfileAgainstDefinitions(wrongVersion, QUEST_DEFINITIONS)).toContain("migration");
		expect(validateQuestProfileAgainstDefinitions(wrongStage, QUEST_DEFINITIONS)).toContain("invalid stage");
	});

	it("rejects missing definitions and objective progress that does not match the current stage", () => {
		const profile = startAutoQuests(createEmptyQuestProfile(), QUEST_DEFINITIONS);
		const questId = QUEST_DEFINITIONS[0].id;
		const active = profile.activeQuests[questId];
		const objectiveId = QUEST_DEFINITIONS[0].stages[0].objectives[0].id;

		expect(validateQuestProfileAgainstDefinitions(profile, [])).toContain("no installed definition");
		expect(
			validateQuestProfileAgainstDefinitions(
				{ ...profile, activeQuests: { [questId]: { ...active, objectiveProgress: {} } } },
				QUEST_DEFINITIONS,
			),
		).toContain(`'${objectiveId}'`);
		expect(
			validateQuestProfileAgainstDefinitions(
				{
					...profile,
					activeQuests: {
						[questId]: {
							...active,
							objectiveProgress: {
								...active.objectiveProgress,
								unexpected: { progress: 0, processedSourceIds: [] },
							},
						},
					},
				},
				QUEST_DEFINITIONS,
			),
		).toContain("unknown objective progress");
	});
});
