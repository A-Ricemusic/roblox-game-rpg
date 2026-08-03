import { describe, expect, it, xdescribe } from "@rbxts/jest-globals";
import { HttpService } from "@rbxts/services";

import { createEmptyQuestProfile } from "shared/quests/QuestEngine";

import { DataStoreQuestProfileRepository, STAGING_QUEST_DATA_STORE_NAME } from "./DataStoreQuestProfileRepository";

const stagingEnabled = game.GetAttribute("RunQuestDataStoreStagingTests") === true;
const describeStaging = stagingEnabled ? describe : xdescribe;

describeStaging("Quest DataStore staging integration", () => {
	it("round-trips and removes a uniquely named staging profile", () => {
		const repository = new DataStoreQuestProfileRepository(STAGING_QUEST_DATA_STORE_NAME);
		const profileKey = `jest:${HttpService.GenerateGUID(false)}`;
		const profile = createEmptyQuestProfile();

		const saved = repository.save(profileKey, profile);
		expect(saved.ok).toBe(true);
		if (!saved.ok) return;

		const loaded = repository.load(profileKey);
		expect(loaded.ok).toBe(true);
		if (loaded.ok) expect(loaded.value).toEqual(profile);

		const removed = repository.removeForStaging(profileKey);
		expect(removed.ok).toBe(true);
	});
});
