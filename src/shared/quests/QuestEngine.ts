import {
	ActiveQuestState,
	CollectibleAcquiredEvent,
	ObjectiveProgressState,
	QuestDefinition,
	QuestEngineResult,
	QuestProfile,
	QuestProgressChange,
	QUEST_PROFILE_SCHEMA_VERSION,
} from "./QuestTypes";

export function createEmptyQuestProfile(): QuestProfile {
	return {
		schemaVersion: QUEST_PROFILE_SCHEMA_VERSION,
		activeQuests: {},
		completedQuestIds: [],
	};
}

function createObjectiveProgress(definition: QuestDefinition, stageIndex: number): Record<string, ObjectiveProgressState> {
	const progress: Record<string, ObjectiveProgressState> = {};
	for (const objective of definition.stages[stageIndex].objectives) {
		progress[objective.id] = { progress: 0, processedSourceIds: [] };
	}
	return progress;
}

export function createActiveQuestState(definition: QuestDefinition, now = os.time()): ActiveQuestState {
	return {
		questId: definition.id,
		definitionVersion: definition.version,
		status: "Active",
		currentStageIndex: 0,
		objectiveProgress: createObjectiveProgress(definition, 0),
		startedAt: now,
		updatedAt: now,
	};
}

export function startAutoQuests(
	profile: QuestProfile,
	definitions: ReadonlyArray<QuestDefinition>,
	now = os.time(),
): QuestProfile {
	const activeQuests: Record<string, ActiveQuestState> = { ...profile.activeQuests };
	let changed = false;

	for (const definition of definitions) {
		if (
			definition.autoStart &&
			activeQuests[definition.id] === undefined &&
			!profile.completedQuestIds.includes(definition.id)
		) {
			activeQuests[definition.id] = createActiveQuestState(definition, now);
			changed = true;
		}
	}

	return changed ? { ...profile, activeQuests } : profile;
}

function stageIsComplete(definition: QuestDefinition, state: ActiveQuestState): boolean {
	const stage = definition.stages[state.currentStageIndex];
	for (const objective of stage.objectives) {
		const progress = state.objectiveProgress[objective.id];
		if (progress === undefined || progress.progress < objective.required) {
			return false;
		}
	}
	return true;
}

function applyEventToQuest(
	definition: QuestDefinition,
	state: ActiveQuestState,
	event: CollectibleAcquiredEvent,
	now: number,
): { readonly state: ActiveQuestState; readonly changes: QuestProgressChange[] } {
	if (state.status !== "Active" || event.quantity < 1 || math.floor(event.quantity) !== event.quantity) {
		return { state, changes: [] };
	}

	const stage = definition.stages[state.currentStageIndex];
	const nextProgress: Record<string, ObjectiveProgressState> = { ...state.objectiveProgress };
	const changes = new Array<QuestProgressChange>();

	for (const objective of stage.objectives) {
		if (
			objective.kind !== "CollectItem" ||
			objective.itemId !== event.itemId ||
			!objective.allowedSources.includes(event.source)
		) {
			continue;
		}

		const current = nextProgress[objective.id] ?? { progress: 0, processedSourceIds: [] };
		if (current.progress >= objective.required || current.processedSourceIds.includes(event.sourceId)) {
			continue;
		}

		const progress = math.min(objective.required, current.progress + event.quantity);
		nextProgress[objective.id] = {
			progress,
			processedSourceIds: [...current.processedSourceIds, event.sourceId],
		};
		changes.push({
			questId: definition.id,
			objectiveId: objective.id,
			previousProgress: current.progress,
			progress,
			required: objective.required,
			stageCompleted: false,
			questCompleted: false,
		});
	}

	if (changes.size() === 0) {
		return { state, changes };
	}

	let nextState: ActiveQuestState = { ...state, objectiveProgress: nextProgress, updatedAt: now };
	if (stageIsComplete(definition, nextState)) {
		const nextStageIndex = state.currentStageIndex + 1;
		const questCompleted = nextStageIndex >= definition.stages.size();
		nextState = questCompleted
			? { ...nextState, status: "Completed" }
			: {
					...nextState,
					currentStageIndex: nextStageIndex,
					objectiveProgress: createObjectiveProgress(definition, nextStageIndex),
			  };

		for (const change of changes) {
			(change as Writable<QuestProgressChange>).stageCompleted = true;
			(change as Writable<QuestProgressChange>).questCompleted = questCompleted;
		}
	}

	return { state: nextState, changes };
}

export function applyCollectibleAcquired(
	profile: QuestProfile,
	definitions: ReadonlyArray<QuestDefinition>,
	event: CollectibleAcquiredEvent,
	now = os.time(),
): QuestEngineResult {
	const definitionsById = new Map<string, QuestDefinition>();
	for (const definition of definitions) {
		definitionsById.set(definition.id, definition);
	}

	const activeQuests: Record<string, ActiveQuestState> = { ...profile.activeQuests };
	const completedQuestIds = [...profile.completedQuestIds];
	const changes = new Array<QuestProgressChange>();

	for (const [questId, state] of pairs(profile.activeQuests)) {
		const definition = definitionsById.get(questId);
		if (definition === undefined || state.definitionVersion !== definition.version) {
			continue;
		}

		const result = applyEventToQuest(definition, state, event, now);
		if (result.changes.size() === 0) {
			continue;
		}

		changes.push(...result.changes);
		if (result.state.status === "Completed") {
			activeQuests[questId] = undefined!;
			if (!completedQuestIds.includes(questId)) {
				completedQuestIds.push(questId);
			}
		} else {
			activeQuests[questId] = result.state;
		}
	}

	return changes.size() === 0
		? { profile, changes }
		: {
				profile: { ...profile, activeQuests, completedQuestIds },
				changes,
		  };
}
