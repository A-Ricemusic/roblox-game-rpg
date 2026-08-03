import { QuestClientRequest, QuestClientView, QuestServerMessage } from "./QuestTypes";
import { asUnknownRecord, isNonNegativeInteger } from "../RuntimeTypeChecks";

export const QUEST_REMOTES_FOLDER_NAME = "QuestRemotes";
export const QUEST_REMOTE_EVENT_NAME = "QuestState";

export function parseQuestClientRequest(value: unknown): QuestClientRequest | undefined {
	const request = asUnknownRecord(value);
	if (request === undefined) return undefined;
	return request.kind === "RequestSnapshot" ? { kind: "RequestSnapshot" } : undefined;
}

function readObjective(value: unknown): QuestClientView["objectives"][number] | undefined {
	const objective = asUnknownRecord(value);
	if (objective === undefined) return undefined;
	if (
		!typeIs(objective.id, "string") ||
		!typeIs(objective.description, "string") ||
		!isNonNegativeInteger(objective.progress) ||
		!isNonNegativeInteger(objective.required) ||
		objective.required < 1
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
	if (quest === undefined) return undefined;
	if (
		!typeIs(quest.questId, "string") ||
		!typeIs(quest.title, "string") ||
		!typeIs(quest.stageTitle, "string") ||
		!typeIs(quest.objectives, "table")
	) {
		return undefined;
	}

	const objectives = new Array<QuestClientView["objectives"][number]>();
	for (const value of quest.objectives as ReadonlyArray<unknown>) {
		const objective = readObjective(value);
		if (objective === undefined) return undefined;
		objectives.push(objective);
	}
	return { questId: quest.questId, title: quest.title, stageTitle: quest.stageTitle, objectives };
}

export function parseQuestServerMessage(value: unknown): QuestServerMessage | undefined {
	const message = asUnknownRecord(value);
	if (message === undefined) return undefined;
	if (message.kind !== "Snapshot" || !typeIs(message.quests, "table")) return undefined;

	const quests = new Array<QuestClientView>();
	for (const value of message.quests as ReadonlyArray<unknown>) {
		const quest = readQuestView(value);
		if (quest === undefined) return undefined;
		quests.push(quest);
	}
	return { kind: "Snapshot", quests };
}
