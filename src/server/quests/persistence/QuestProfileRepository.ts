import { QuestProfile } from "shared/quests/QuestTypes";

export type RepositoryResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: string; readonly retryable: boolean };

export interface QuestProfileRepository {
	load(profileKey: string): RepositoryResult<unknown>;
	save(profileKey: string, profile: QuestProfile): RepositoryResult<void>;
}
