import { describe, expect, it } from "@rbxts/jest-globals";

import { QUEST_DEFINITIONS } from "./QuestDefinitions";
import { validateQuestDefinitions } from "./QuestDefinitionValidator";
import { QuestDefinition } from "./QuestTypes";

describe("QuestDefinitionValidator", () => {
	it("accepts all shipped quest definitions", () => {
		expect(validateQuestDefinitions(QUEST_DEFINITIONS)).toHaveLength(0);
	});

	it("reports duplicate IDs and invalid requirements", () => {
		const invalid = {
			id: "duplicate",
			version: 0,
			title: "",
			summary: "",
			autoStart: true,
			stages: [
				{
					id: "stage",
					title: "",
					objectives: [
						{
							id: "objective",
							kind: "CollectItem",
							description: "",
							itemId: "",
							required: 0,
							allowedSources: [],
						},
					],
				},
			],
		} as const satisfies QuestDefinition;

		const issues = validateQuestDefinitions([invalid, { ...invalid, version: 1, title: "Duplicate" }]);
		expect(issues.size()).toBeGreaterThanOrEqual(8);
		expect(issues.some((issue) => issue.message.find("Duplicate quest ID")[0] !== undefined)).toBe(true);
		expect(issues.some((issue) => issue.path === "quests[0].summary")).toBe(true);
		expect(issues.some((issue) => issue.path === "quests[0].stages[0].title")).toBe(true);
	});
});
