import { asUnknownRecord, isNonNegativeInteger } from "../RuntimeTypeChecks";
import { MAX_OBJECTIVE_REQUIREMENT, MAX_OBJECTIVES_PER_STAGE, MAX_QUEST_DEFINITIONS } from "./QuestProfileLimits";
import { QuestClientRequest, QuestClientView, QuestServerMessage } from "./QuestTypes";

export const QUEST_REMOTES_FOLDER_NAME = "QuestRemotes";
export const QUEST_REMOTE_EVENT_NAME = "QuestState";

const MAX_QUEST_ID_LENGTH = 128;
const MAX_QUEST_TITLE_LENGTH = 128;
const MAX_QUEST_SUMMARY_LENGTH = 512;
const MAX_QUEST_DESCRIPTION_LENGTH = 256;

function hasOnlyKeys(record: Readonly<Record<string, unknown>>, keys: ReadonlySet<string>): boolean {
	for (const [key] of pairs(record)) if (!keys.has(key)) return false;
	return true;
}

function isBoundedString(value: unknown, maximumLength: number): value is string {
	return typeIs(value, "string") && value.size() > 0 && value.size() <= maximumLength;
}

function readDenseArray(value: unknown, maximumLength: number): ReadonlyArray<unknown> | undefined {
	if (!typeIs(value, "table")) return undefined;
	const array = value as ReadonlyArray<unknown>;
	const length = array.size();
	if (length > maximumLength) return undefined;
	let entries = 0;
	for (const [key] of pairs(value as Readonly<Record<number, unknown>>)) {
		if (!typeIs(key, "number") || key < 1 || key > length || math.floor(key) !== key) return undefined;
		entries += 1;
	}
	return entries === length ? array : undefined;
}

export function parseQuestClientRequest(value: unknown): QuestClientRequest | undefined {
	const request = asUnknownRecord(value);
	if (request === undefined || request.kind !== "RequestSnapshot" || !hasOnlyKeys(request, new Set(["kind"]))) {
		return undefined;
	}
	return { kind: "RequestSnapshot" };
}

function readObjective(value: unknown): QuestClientView["objectives"][number] | undefined {
	const objective = asUnknownRecord(value);
	if (
		objective === undefined ||
		!hasOnlyKeys(objective, new Set(["id", "description", "progress", "required"])) ||
		!isBoundedString(objective.id, MAX_QUEST_ID_LENGTH) ||
		!isBoundedString(objective.description, MAX_QUEST_DESCRIPTION_LENGTH) ||
		!isNonNegativeInteger(objective.progress) ||
		!isNonNegativeInteger(objective.required) ||
		objective.required < 1 ||
		objective.required > MAX_OBJECTIVE_REQUIREMENT ||
		objective.progress > objective.required
	) {
		return undefined;
	}
	return {
		id: objective.id,
		description: objective.description,
		progress: objective.progress,
		required: objective.required,
	};
}

function readQuestView(value: unknown): QuestClientView | undefined {
	const quest = asUnknownRecord(value);
	if (
		quest === undefined ||
		!hasOnlyKeys(quest, new Set(["questId", "title", "summary", "status", "stageTitle", "objectives"])) ||
		!isBoundedString(quest.questId, MAX_QUEST_ID_LENGTH) ||
		!isBoundedString(quest.title, MAX_QUEST_TITLE_LENGTH) ||
		!isBoundedString(quest.summary, MAX_QUEST_SUMMARY_LENGTH) ||
		(quest.status !== "Active" && quest.status !== "Completed") ||
		!isBoundedString(quest.stageTitle, MAX_QUEST_TITLE_LENGTH)
	) {
		return undefined;
	}
	const rawObjectives = readDenseArray(quest.objectives, MAX_OBJECTIVES_PER_STAGE);
	if (rawObjectives === undefined) return undefined;
	if (
		(quest.status === "Active" && rawObjectives.size() === 0) ||
		(quest.status === "Completed" && rawObjectives.size() > 0)
	) {
		return undefined;
	}

	const objectives = new Array<QuestClientView["objectives"][number]>();
	for (const value of rawObjectives) {
		const objective = readObjective(value);
		if (objective === undefined) return undefined;
		objectives.push(objective);
	}
	return {
		questId: quest.questId,
		title: quest.title,
		summary: quest.summary,
		status: quest.status,
		stageTitle: quest.stageTitle,
		objectives,
	};
}

export function parseQuestServerMessage(value: unknown): QuestServerMessage | undefined {
	const message = asUnknownRecord(value);
	if (message === undefined || message.kind !== "Snapshot" || !hasOnlyKeys(message, new Set(["kind", "quests"]))) {
		return undefined;
	}
	const rawQuests = readDenseArray(message.quests, MAX_QUEST_DEFINITIONS);
	if (rawQuests === undefined) return undefined;

	const quests = new Array<QuestClientView>();
	const questIds = new Set<string>();
	for (const value of rawQuests) {
		const quest = readQuestView(value);
		if (quest === undefined || questIds.has(quest.questId)) return undefined;
		questIds.add(quest.questId);
		quests.push(quest);
	}
	return { kind: "Snapshot", quests };
}
