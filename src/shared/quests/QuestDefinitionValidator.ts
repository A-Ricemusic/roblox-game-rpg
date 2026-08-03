import { QuestDefinition } from "./QuestTypes";

export interface QuestDefinitionIssue {
	readonly path: string;
	readonly message: string;
}

const MAX_ID_LENGTH = 128;
const MAX_OBJECTIVE_REQUIREMENT = 1_000_000;

function validateId(id: string, path: string, issues: QuestDefinitionIssue[]): void {
	if (id.size() === 0) {
		issues.push({ path, message: "ID must not be empty." });
	} else if (id.size() > MAX_ID_LENGTH) {
		issues.push({ path, message: `ID must not exceed ${MAX_ID_LENGTH} characters.` });
	}
}

export function validateQuestDefinitions(definitions: ReadonlyArray<QuestDefinition>): QuestDefinitionIssue[] {
	const issues = new Array<QuestDefinitionIssue>();
	const questIds = new Set<string>();

	for (let questIndex = 0; questIndex < definitions.size(); questIndex++) {
		const quest = definitions[questIndex];
		const questPath = `quests[${questIndex}]`;
		validateId(quest.id, `${questPath}.id`, issues);

		if (questIds.has(quest.id)) {
			issues.push({ path: `${questPath}.id`, message: `Duplicate quest ID '${quest.id}'.` });
		}
		questIds.add(quest.id);

		if (quest.version < 1 || math.floor(quest.version) !== quest.version) {
			issues.push({ path: `${questPath}.version`, message: "Version must be a positive integer." });
		}

		if (quest.title.size() === 0) {
			issues.push({ path: `${questPath}.title`, message: "Title must not be empty." });
		}
		if (quest.summary.size() === 0) {
			issues.push({ path: `${questPath}.summary`, message: "Summary must not be empty." });
		}

		if (quest.stages.size() === 0) {
			issues.push({ path: `${questPath}.stages`, message: "A quest must contain at least one stage." });
		}

		const stageIds = new Set<string>();
		const objectiveIds = new Set<string>();

		for (let stageIndex = 0; stageIndex < quest.stages.size(); stageIndex++) {
			const stage = quest.stages[stageIndex];
			const stagePath = `${questPath}.stages[${stageIndex}]`;
			validateId(stage.id, `${stagePath}.id`, issues);

			if (stageIds.has(stage.id)) {
				issues.push({ path: `${stagePath}.id`, message: `Duplicate stage ID '${stage.id}'.` });
			}
			stageIds.add(stage.id);
			if (stage.title.size() === 0) {
				issues.push({ path: `${stagePath}.title`, message: "Title must not be empty." });
			}

			if (stage.objectives.size() === 0) {
				issues.push({
					path: `${stagePath}.objectives`,
					message: "A stage must contain at least one objective.",
				});
			}

			for (let objectiveIndex = 0; objectiveIndex < stage.objectives.size(); objectiveIndex++) {
				const objective = stage.objectives[objectiveIndex];
				const objectivePath = `${stagePath}.objectives[${objectiveIndex}]`;
				validateId(objective.id, `${objectivePath}.id`, issues);

				if (objectiveIds.has(objective.id)) {
					issues.push({ path: `${objectivePath}.id`, message: `Duplicate objective ID '${objective.id}'.` });
				}
				objectiveIds.add(objective.id);

				if (objective.description.size() === 0) {
					issues.push({ path: `${objectivePath}.description`, message: "Description must not be empty." });
				}

				if (objective.kind === "CollectItem") {
					validateId(objective.itemId, `${objectivePath}.itemId`, issues);
					if (
						objective.required < 1 ||
						math.floor(objective.required) !== objective.required ||
						objective.required > MAX_OBJECTIVE_REQUIREMENT
					) {
						issues.push({
							path: `${objectivePath}.required`,
							message: `Requirement must be an integer between 1 and ${MAX_OBJECTIVE_REQUIREMENT}.`,
						});
					}
					if (objective.allowedSources.size() === 0) {
						issues.push({
							path: `${objectivePath}.allowedSources`,
							message: "At least one source is required.",
						});
					}
				}
			}
		}
	}

	return issues;
}

export function assertValidQuestDefinitions(definitions: ReadonlyArray<QuestDefinition>): void {
	const issues = validateQuestDefinitions(definitions);
	if (issues.size() > 0) {
		const lines = issues.map((issue) => `${issue.path}: ${issue.message}`);
		error(`Invalid quest definitions:\n${lines.join("\n")}`);
	}
}
