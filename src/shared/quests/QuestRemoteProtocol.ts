import { QuestClientRequest } from "./QuestTypes";

export function parseQuestClientRequest(value: unknown): QuestClientRequest | undefined {
	if (!typeIs(value, "table")) {
		return undefined;
	}

	const request = value as Readonly<Record<string, unknown>>;
	return request.kind === "RequestSnapshot" ? { kind: "RequestSnapshot" } : undefined;
}
