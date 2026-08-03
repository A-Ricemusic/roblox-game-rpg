import { QuestDefinition, QuestProfile } from "./QuestTypes";

export function validateQuestProfileAgainstDefinitions(
	profile: QuestProfile,
	definitions: ReadonlyArray<QuestDefinition>,
): string | undefined {
	const definitionsById = new Map<string, QuestDefinition>();
	for (const definition of definitions) definitionsById.set(definition.id, definition);

	for (const [questId, state] of pairs(profile.activeQuests)) {
		const definition = definitionsById.get(questId);
		if (definition === undefined) return `Active quest '${questId}' has no installed definition.`;
		if (state.definitionVersion !== definition.version) {
			return `Active quest '${questId}' requires a definition migration from version ${state.definitionVersion} to ${definition.version}.`;
		}

		const stage = definition.stages[state.currentStageIndex];
		if (stage === undefined) return `Active quest '${questId}' references an invalid stage.`;
		const expectedObjectives = new Set<string>();
		for (const objective of stage.objectives) {
			expectedObjectives.add(objective.id);
			const progress = state.objectiveProgress[objective.id];
			if (progress === undefined || progress.progress > objective.required) {
				return `Active quest '${questId}' has invalid progress for objective '${objective.id}'.`;
			}
			if (progress.processedSourceIds.size() > progress.progress) {
				return `Active quest '${questId}' has impossible source history for objective '${objective.id}'.`;
			}
		}
		for (const [objectiveId] of pairs(state.objectiveProgress)) {
			if (!expectedObjectives.has(objectiveId)) {
				return `Active quest '${questId}' contains unknown objective progress '${objectiveId}'.`;
			}
		}
	}
	return undefined;
}
