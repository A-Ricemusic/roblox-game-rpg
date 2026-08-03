import { describe, expect, it } from "@rbxts/jest-globals";

import { createEmptyQuestProfile } from "shared/quests/QuestEngine";

import { InMemoryQuestProfileRepository } from "./InMemoryQuestProfileRepository";

describe("InMemoryQuestProfileRepository", () => {
	it("round-trips profiles without external services", () => {
		const repository = new InMemoryQuestProfileRepository();
		const profile = createEmptyQuestProfile();
		expect(repository.load("player:1")).toEqual({ ok: true, value: undefined });
		expect(repository.save("player:1", profile).ok).toBe(true);
		expect(repository.load("player:1")).toEqual({ ok: true, value: profile });
	});
});
