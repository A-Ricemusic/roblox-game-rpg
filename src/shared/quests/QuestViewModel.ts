import { QuestClientView, QuestDefinition, QuestProfile } from "./QuestTypes";

export function buildQuestClientViews(
	profile: QuestProfile,
	definitions: ReadonlyArray<QuestDefinition>,
): QuestClientView[] {
	const definitionsById = new Map<string, QuestDefinition>();
	for (const definition of definitions) definitionsById.set(definition.id, definition);

	const views = new Array<QuestClientView>();
	for (const [questId, state] of pairs(profile.activeQuests)) {
		const definition = definitionsById.get(questId);
		const stage = definition?.stages[state.currentStageIndex];
		if (definition === undefined || stage === undefined || state.status !== "Active") continue;

		views.push({
			questId,
			title: definition.title,
			summary: definition.summary,
			status: "Active",
			stageTitle: stage.title,
			objectives: stage.objectives.map((objective) => ({
				id: objective.id,
				description: objective.description,
				progress: math.min(
					objective.required,
					math.max(0, state.objectiveProgress[objective.id]?.progress ?? 0),
				),
				required: objective.required,
			})),
		});
	}
	for (const questId of profile.completedQuestIds) {
		if (profile.activeQuests[questId] !== undefined) continue;
		const definition = definitionsById.get(questId);
		if (definition === undefined) continue;
		views.push({
			questId,
			title: definition.title,
			summary: definition.summary,
			status: "Completed",
			stageTitle: "Journey complete",
			objectives: [],
		});
	}

	views.sort((left, right) => {
		if (left.status !== right.status) return left.status === "Active";
		return left.title === right.title ? left.questId < right.questId : left.title < right.title;
	});
	return views;
}
