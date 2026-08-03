import { QuestDefinition } from "./QuestTypes";

export const SACRED_OLIVE_BRANCH_ITEM_ID = "sacred_olive_branch";

export const FIRST_HARVEST_QUEST = {
	id: "the_first_harvest",
	version: 1,
	title: "The First Harvest",
	summary: "Gather sacred olive branches from the grove as an offering to the gods.",
	autoStart: true,
	stages: [
		{
			id: "gather_the_offering",
			title: "An Offering from the Grove",
			objectives: [
				{
					id: "collect_sacred_olive_branches",
					kind: "CollectItem",
					description: "Collect Sacred Olive Branches",
					itemId: SACRED_OLIVE_BRANCH_ITEM_ID,
					required: 3,
					allowedSources: ["WorldTag"],
				},
			],
		},
	],
} as const satisfies QuestDefinition;

export const QUEST_DEFINITIONS = [FIRST_HARVEST_QUEST] as const satisfies ReadonlyArray<QuestDefinition>;
