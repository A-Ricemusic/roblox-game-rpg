import { describe, expect, it } from "@rbxts/jest-globals";

import { parseQuestClientRequest, parseQuestServerMessage } from "./QuestRemoteProtocol";

describe("QuestRemoteProtocol", () => {
	it("allows the read-only snapshot request", () => {
		expect(parseQuestClientRequest({ kind: "RequestSnapshot" })).toEqual({ kind: "RequestSnapshot" });
	});

	it("rejects malformed and client-authored progress requests", () => {
		expect(parseQuestClientRequest(undefined)).toBeUndefined();
		expect(parseQuestClientRequest("RequestSnapshot")).toBeUndefined();
		expect(parseQuestClientRequest({ kind: "CollectItem", itemId: "olive", quantity: 999 })).toBeUndefined();
		expect(parseQuestClientRequest({ kind: 123 })).toBeUndefined();
	});

	it("validates server snapshots before the client renders them", () => {
		const snapshot = {
			kind: "Snapshot",
			quests: [
				{
					questId: "olive",
					title: "The First Harvest",
					stageTitle: "Gather",
					objectives: [{ id: "collect", description: "Collect olives", progress: 1, required: 3 }],
				},
			],
		};
		expect(parseQuestServerMessage(snapshot)).toEqual(snapshot);
		expect(parseQuestServerMessage({ kind: "Snapshot", quests: [{ title: 123 }] })).toBeUndefined();
	});
});
