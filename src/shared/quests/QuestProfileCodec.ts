import { ActiveQuestState, ObjectiveProgressState, QuestProfile, QUEST_PROFILE_SCHEMA_VERSION } from "./QuestTypes";
import { createEmptyQuestProfile } from "./QuestEngine";

export type QuestProfileDecodeResult =
	| { readonly ok: true; readonly profile: QuestProfile; readonly migrated: boolean }
	| { readonly ok: false; readonly error: string };

const MAX_PERSISTED_ID_LENGTH = 128;

function asTable(value: unknown): Readonly<Record<string, unknown>> | undefined {
	return typeIs(value, "table") ? (value as Readonly<Record<string, unknown>>) : undefined;
}

function isValidId(value: unknown): value is string {
	return typeIs(value, "string") && value.size() > 0 && value.size() <= MAX_PERSISTED_ID_LENGTH;
}

function isNonNegativeInteger(value: unknown): value is number {
	return typeIs(value, "number") && value >= 0 && value < math.huge && math.floor(value) === value;
}

function isPositiveInteger(value: unknown): value is number {
	return isNonNegativeInteger(value) && value > 0;
}

function readStringArray(value: unknown, requireUnique = false): string[] | undefined {
	if (!typeIs(value, "table")) {
		return undefined;
	}

	const output = new Array<string>();
	const seen = new Set<string>();
	for (const entry of value as ReadonlyArray<unknown>) {
		if (!isValidId(entry) || (requireUnique && seen.has(entry))) {
			return undefined;
		}
		output.push(entry);
		seen.add(entry);
	}
	return output;
}

function readObjectiveProgress(value: unknown, legacy: boolean): Record<string, ObjectiveProgressState> | undefined {
	const record = asTable(value);
	if (record === undefined) {
		return undefined;
	}

	const output: Record<string, ObjectiveProgressState> = {};
	for (const [objectiveId, rawState] of pairs(record)) {
		if (!isValidId(objectiveId)) {
			return undefined;
		}

		if (legacy && isNonNegativeInteger(rawState)) {
			output[objectiveId] = { progress: rawState, processedSourceIds: [] };
			continue;
		}

		const state = asTable(rawState);
		if (state === undefined || !isNonNegativeInteger(state.progress)) {
			return undefined;
		}
		const sourceIds = readStringArray(state.processedSourceIds, true);
		if (sourceIds === undefined) {
			return undefined;
		}
		output[objectiveId] = { progress: state.progress, processedSourceIds: sourceIds };
	}
	return output;
}

function readActiveQuests(value: unknown, legacy: boolean): Record<string, ActiveQuestState> | undefined {
	const record = asTable(value);
	if (record === undefined) {
		return undefined;
	}

	const output: Record<string, ActiveQuestState> = {};
	for (const [questId, rawState] of pairs(record)) {
		if (!isValidId(questId)) {
			return undefined;
		}

		const state = asTable(rawState);
		if (
			state === undefined ||
			state.questId !== questId ||
			!isPositiveInteger(state.definitionVersion) ||
			!isNonNegativeInteger(state.currentStageIndex) ||
			!isNonNegativeInteger(state.startedAt) ||
			!isNonNegativeInteger(state.updatedAt)
		) {
			return undefined;
		}

		const status = legacy && state.status === undefined ? "Active" : state.status;
		if (status !== "Active") {
			return undefined;
		}

		const objectiveProgress = readObjectiveProgress(state.objectiveProgress, legacy);
		if (objectiveProgress === undefined) {
			return undefined;
		}

		output[questId] = {
			questId: state.questId,
			definitionVersion: state.definitionVersion,
			status,
			currentStageIndex: state.currentStageIndex,
			objectiveProgress,
			startedAt: state.startedAt,
			updatedAt: state.updatedAt,
		};
	}
	return output;
}

export function decodeQuestProfile(value: unknown): QuestProfileDecodeResult {
	if (value === undefined) {
		return { ok: true, profile: createEmptyQuestProfile(), migrated: false };
	}

	const record = asTable(value);
	if (record === undefined || !typeIs(record.schemaVersion, "number")) {
		return { ok: false, error: "Quest profile must be a table with a numeric schemaVersion." };
	}

	if (record.schemaVersion !== 0 && record.schemaVersion !== QUEST_PROFILE_SCHEMA_VERSION) {
		return { ok: false, error: `Unsupported quest profile schema version '${record.schemaVersion}'.` };
	}

	const legacy = record.schemaVersion === 0;
	const activeQuests = readActiveQuests(record.activeQuests, legacy);
	const completedQuestIds = readStringArray(record.completedQuestIds, true);
	if (activeQuests === undefined || completedQuestIds === undefined) {
		return { ok: false, error: "Quest profile contains invalid active quest or completion data." };
	}
	for (const completedQuestId of completedQuestIds) {
		if (activeQuests[completedQuestId] !== undefined) {
			return { ok: false, error: `Quest '${completedQuestId}' cannot be both active and completed.` };
		}
	}

	return {
		ok: true,
		profile: {
			schemaVersion: QUEST_PROFILE_SCHEMA_VERSION,
			activeQuests,
			completedQuestIds,
		},
		migrated: legacy,
	};
}
