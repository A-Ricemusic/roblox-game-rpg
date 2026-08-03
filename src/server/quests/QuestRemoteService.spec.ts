import { describe, expect, it } from "@rbxts/jest-globals";

import { QUEST_DEFINITIONS } from "shared/quests/QuestDefinitions";

import { createTestPlayerServices } from "server/player/testing/createTestPlayerServices";

import { QuestRemoteService } from "./QuestRemoteService";

describe("QuestRemoteService", () => {
	it("creates snapshots only for loaded profiles", () => {
		const services = createTestPlayerServices();
		const profiles = services.quests;
		const remote = new Instance("RemoteEvent");
		const service = new QuestRemoteService(remote, profiles, QUEST_DEFINITIONS);

		expect(service.createSnapshot("player:1")).toBeUndefined();
		expect(services.playerProfiles.load("player:1").ok).toBe(true);
		expect(service.createSnapshot("player:1")?.quests).toHaveLength(1);
		remote.Destroy();
	});

	it("rejects malformed, progress-authoring, and rate-limited requests", () => {
		let now = 10;
		const profiles = createTestPlayerServices().quests;
		const remote = new Instance("RemoteEvent");
		const service = new QuestRemoteService(remote, profiles, QUEST_DEFINITIONS, () => now);

		expect(service.acceptRequest("player:1", { kind: "CollectItem", quantity: 999 })).toBe(false);
		expect(service.acceptRequest("player:1", { kind: "RequestSnapshot" })).toBe(true);
		expect(service.acceptRequest("player:1", { kind: "RequestSnapshot" })).toBe(false);
		now += 0.25;
		expect(service.acceptRequest("player:1", { kind: "RequestSnapshot" })).toBe(true);
		service.forget("player:1");
		expect(service.acceptRequest("player:1", { kind: "RequestSnapshot" })).toBe(true);
		remote.Destroy();
	});
});
