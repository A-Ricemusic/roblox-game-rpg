import { PlayerProfile } from "shared/player/PlayerProfile";

export type RepositoryResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: string; readonly retryable: boolean };

export interface PlayerProfileRepository {
	load(profileKey: string): RepositoryResult<unknown>;
	save(profileKey: string, profile: PlayerProfile): RepositoryResult<void>;
	release(profileKey: string, profile: PlayerProfile): RepositoryResult<void>;
	abandon(profileKey: string): RepositoryResult<void>;
}
