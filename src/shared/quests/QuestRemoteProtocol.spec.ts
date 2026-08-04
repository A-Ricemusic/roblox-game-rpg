import { describe, expect, it } from "@rbxts/jest-globals";

import { parseQuestClientRequest, parseQuestServerMessage } from "./QuestRemoteProtocol";

describe("QuestRemoteProtocol", () => {
	it("allows the read-only snapshot request", () => {
		expect(parseQuestClientRequest({ kind: "RequestSnapshot" })).toEqual({ kind: "RequestSnapshot" });
		expect(parseQuestClientRequest({ kind: "RequestSnapshot", questId: "spoof" })).toBeUndefined();
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
					summary: "Gather an offering.",
					status: "Active",
					stageTitle: "Gather",
					objectives: [{ id: "collect", description: "Collect olives", progress: 1, required: 3 }],
				},
			],
		};
		expect(parseQuestServerMessage(snapshot)).toEqual(snapshot);
		expect(parseQuestServerMessage({ kind: "Snapshot", quests: [{ title: 123 }] })).toBeUndefined();
		expect(
			parseQuestServerMessage({
				...snapshot,
				quests: [
					{ ...snapshot.quests[0], objectives: [{ ...snapshot.quests[0].objectives[0], progress: 0.5 }] },
				],
			}),
		).toBeUndefined();
		expect(
			parseQuestServerMessage({
				kind: "Snapshot",
				quests: [
					{
						questId: "done",
						title: "Completed",
						summary: "Done.",
						status: "Completed",
						stageTitle: "Journey complete",
						objectives: [],
					},
				],
			}),
		).toBeDefined();
		expect(parseQuestServerMessage({ ...snapshot, unexpected: true })).toBeUndefined();
	});
});
