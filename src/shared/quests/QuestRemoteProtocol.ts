import { QuestClientRequest, QuestClientView, QuestServerMessage } from "./QuestTypes";

export const QUEST_REMOTES_FOLDER_NAME = "QuestRemotes";
export const QUEST_REMOTE_EVENT_NAME = "QuestState";

function isNonNegativeInteger(value: unknown): value is number {
	return typeIs(value, "number") && value >= 0 && value < math.huge && math.floor(value) === value;
}

export function parseQuestClientRequest(value: unknown): QuestClientRequest | undefined {
	if (!typeIs(value, "table")) {
		return undefined;
	}

	const request = value as Readonly<Record<string, unknown>>;
	return request.kind === "RequestSnapshot" ? { kind: "RequestSnapshot" } : undefined;
}

function readObjective(value: unknown): QuestClientView["objectives"][number] | undefined {
	if (!typeIs(value, "table")) return undefined;
	const objective = value as Readonly<Record<string, unknown>>;
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
	if (!typeIs(value, "table")) return undefined;
	const quest = value as Readonly<Record<string, unknown>>;
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
	if (!typeIs(value, "table")) return undefined;
	const message = value as Readonly<Record<string, unknown>>;
	if (message.kind !== "Snapshot" || !typeIs(message.quests, "table")) return undefined;

	const quests = new Array<QuestClientView>();
	for (const value of message.quests as ReadonlyArray<unknown>) {
		const quest = readQuestView(value);
		if (quest === undefined) return undefined;
		quests.push(quest);
	}
	return { kind: "Snapshot", quests };
}
