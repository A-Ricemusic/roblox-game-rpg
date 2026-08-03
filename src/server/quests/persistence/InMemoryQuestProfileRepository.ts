import { QuestProfile } from "shared/quests/QuestTypes";

import { QuestProfileRepository, RepositoryResult } from "./QuestProfileRepository";

/** Development-only repository used when an unpublished place has no DataStore identity. */
export class InMemoryQuestProfileRepository implements QuestProfileRepository {
	private readonly values = new Map<string, QuestProfile>();

	public load(profileKey: string): RepositoryResult<unknown> {
		return { ok: true, value: this.values.get(profileKey) };
	}

	public save(profileKey: string, profile: QuestProfile): RepositoryResult<void> {
		this.values.set(profileKey, profile);
		return { ok: true, value: undefined };
	}
}
