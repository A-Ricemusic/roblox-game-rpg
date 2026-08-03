import { DataStoreService } from "@rbxts/services";

import { PlayerProfile } from "shared/player/PlayerProfile";

import { PlayerProfileRepository, RepositoryResult } from "./PlayerProfileRepository";

export const PLAYER_PROFILE_DATA_STORE_NAME = "PlayerProfiles_v1";

function formatError(value: unknown): string {
	return typeIs(value, "string") ? value : "Unknown DataStore error";
}

export class DataStorePlayerProfileRepository implements PlayerProfileRepository {
	private readonly dataStore: DataStore;

	public constructor(dataStoreName = PLAYER_PROFILE_DATA_STORE_NAME) {
		this.dataStore = DataStoreService.GetDataStore(dataStoreName);
	}

	public load(profileKey: string): RepositoryResult<unknown> {
		const [ok, value] = pcall(() => this.dataStore.GetAsync(profileKey));
		return ok ? { ok: true, value } : { ok: false, error: formatError(value), retryable: true };
	}

	public save(profileKey: string, profile: PlayerProfile): RepositoryResult<void> {
		const [ok, value] = pcall(() => this.dataStore.UpdateAsync(profileKey, () => $tuple(profile)));
		return ok ? { ok: true, value: undefined } : { ok: false, error: formatError(value), retryable: true };
	}

	public renew(_profileKey: string): RepositoryResult<void> {
		return { ok: true, value: undefined };
	}

	public release(profileKey: string, profile: PlayerProfile): RepositoryResult<void> {
		return this.save(profileKey, profile);
	}

	public abandon(_profileKey: string): RepositoryResult<void> {
		return { ok: true, value: undefined };
	}
}
