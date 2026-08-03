import { PlayerProfile } from "shared/player/PlayerProfile";

export type RepositoryResult<T> =
	| { readonly ok: true; readonly value: T }
	| {
			readonly ok: false;
			readonly error: string;
			readonly retryable: boolean;
			readonly kind?: "OwnershipLost";
	  };

export interface PlayerProfileRepository {
	load(profileKey: string): RepositoryResult<unknown>;
	renew(profileKey: string): RepositoryResult<void>;
	save(profileKey: string, profile: PlayerProfile): RepositoryResult<void>;
	release(profileKey: string, profile: PlayerProfile): RepositoryResult<void>;
	abandon(profileKey: string): RepositoryResult<void>;
}
