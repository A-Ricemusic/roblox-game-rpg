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
import { MAX_PROCESSED_SOURCES_PER_OBJECTIVE, MAX_TOTAL_PROCESSED_SOURCE_IDS } from "./QuestProfileLimits";

export function createEmptyQuestProfile(): QuestProfile {
	return {
		schemaVersion: QUEST_PROFILE_SCHEMA_VERSION,
		activeQuests: {},
		completedQuestIds: [],
	};
}

function createObjectiveProgress(
	definition: QuestDefinition,
	stageIndex: number,
): Record<string, ObjectiveProgressState> {
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
	maximumNewSourceIds: number,
): { readonly state: ActiveQuestState; readonly changes: QuestProgressChange[] } {
	if (state.status !== "Active" || event.quantity < 1 || math.floor(event.quantity) !== event.quantity) {
		return { state, changes: [] };
	}

	const stage = definition.stages[state.currentStageIndex];
	const nextProgress: Record<string, ObjectiveProgressState> = { ...state.objectiveProgress };
	const changes = new Array<QuestProgressChange>();

	for (const objective of stage.objectives) {
		if (changes.size() >= maximumNewSourceIds) break;
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
		if (current.processedSourceIds.size() >= MAX_PROCESSED_SOURCES_PER_OBJECTIVE) continue;

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
	const stageCompleted = stageIsComplete(definition, nextState);
	let questCompleted = false;
	if (stageCompleted) {
		const nextStageIndex = state.currentStageIndex + 1;
		questCompleted = nextStageIndex >= definition.stages.size();
		nextState = questCompleted
			? { ...nextState, status: "Completed" }
			: {
					...nextState,
					currentStageIndex: nextStageIndex,
					objectiveProgress: createObjectiveProgress(definition, nextStageIndex),
				};
	}

	return {
		state: nextState,
		changes: stageCompleted
			? changes.map((change) => ({ ...change, stageCompleted: true, questCompleted }))
			: changes,
	};
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

	const activeQuests: Record<string, ActiveQuestState> = {};
	const completedQuestIds = [...profile.completedQuestIds];
	const changes = new Array<QuestProgressChange>();
	let processedSourceCount = 0;
	for (const [_questId, state] of pairs(profile.activeQuests)) {
		for (const [_objectiveId, progress] of pairs(state.objectiveProgress)) {
			processedSourceCount += progress.processedSourceIds.size();
		}
	}
	let remainingSourceIds = math.max(0, MAX_TOTAL_PROCESSED_SOURCE_IDS - processedSourceCount);

	for (const [questId, state] of pairs(profile.activeQuests)) {
		const definition = definitionsById.get(questId);
		if (definition === undefined || state.definitionVersion !== definition.version) {
			activeQuests[questId] = state;
			continue;
		}

		const result = applyEventToQuest(definition, state, event, now, remainingSourceIds);
		if (result.changes.size() === 0) {
			activeQuests[questId] = state;
			continue;
		}

		for (const change of result.changes) {
			changes.push(change);
		}
		remainingSourceIds -= result.changes.size();
		if (result.state.status === "Completed") {
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
