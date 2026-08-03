import { DataStoreService } from "@rbxts/services";

import { QuestProfile } from "shared/quests/QuestTypes";

import { QuestProfileRepository, RepositoryResult } from "./QuestProfileRepository";

export const PRODUCTION_QUEST_DATA_STORE_NAME = "PlayerQuestProfiles_v1";
export const STAGING_QUEST_DATA_STORE_NAME = "PlayerQuestProfiles_Staging_v1";

function formatDataStoreError(value: unknown): string {
	return typeIs(value, "string") ? value : "Unknown DataStore error";
}

export class DataStoreQuestProfileRepository implements QuestProfileRepository {
	private readonly dataStore: DataStore;

	public constructor(dataStoreName = PRODUCTION_QUEST_DATA_STORE_NAME) {
		this.dataStore = DataStoreService.GetDataStore(dataStoreName);
	}

	public load(profileKey: string): RepositoryResult<unknown> {
		const [ok, value] = pcall(() => this.dataStore.GetAsync(profileKey));
		return ok ? { ok: true, value } : { ok: false, error: formatDataStoreError(value), retryable: true };
	}

	public save(profileKey: string, profile: QuestProfile): RepositoryResult<void> {
		const [ok, errorValue] = pcall(() => {
			this.dataStore.UpdateAsync(profileKey, () => $tuple(profile));
		});
		return ok
			? { ok: true, value: undefined }
			: { ok: false, error: formatDataStoreError(errorValue), retryable: true };
	}

	public removeForStaging(profileKey: string): RepositoryResult<void> {
		const [ok, errorValue] = pcall(() => this.dataStore.RemoveAsync(profileKey));
		return ok
			? { ok: true, value: undefined }
			: { ok: false, error: formatDataStoreError(errorValue), retryable: true };
	}
}
