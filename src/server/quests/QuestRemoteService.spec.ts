import { describe, expect, it } from "@rbxts/jest-globals";

import { QUEST_DEFINITIONS } from "shared/quests/QuestDefinitions";

import { ResilientQuestProfileStore } from "./persistence/ResilientQuestProfileStore";
import { QuestProfileService } from "./QuestProfileService";
import { QuestRemoteService } from "./QuestRemoteService";
import { FakeQuestProfileRepository } from "./testing/FakeQuestProfileRepository";

describe("QuestRemoteService", () => {
	it("creates snapshots only for loaded profiles", () => {
		const repository = new FakeQuestProfileRepository();
		const profiles = new QuestProfileService(
			new ResilientQuestProfileStore(repository, { maxAttempts: 1, baseDelaySeconds: 0, maxDelaySeconds: 0 }),
			QUEST_DEFINITIONS,
		);
		const remote = new Instance("RemoteEvent");
		const service = new QuestRemoteService(remote, profiles, QUEST_DEFINITIONS);

		expect(service.createSnapshot("player:1")).toBeUndefined();
		expect(profiles.load("player:1").ok).toBe(true);
		expect(service.createSnapshot("player:1")?.quests).toHaveLength(1);
		remote.Destroy();
	});

	it("rejects malformed, progress-authoring, and rate-limited requests", () => {
		let now = 10;
		const repository = new FakeQuestProfileRepository();
		const profiles = new QuestProfileService(
			new ResilientQuestProfileStore(repository, { maxAttempts: 1, baseDelaySeconds: 0, maxDelaySeconds: 0 }),
			QUEST_DEFINITIONS,
		);
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
