import { PlayerProfile } from "shared/player/PlayerProfile";

import { PlayerProfileRepository, RepositoryResult } from "./PlayerProfileRepository";

export class InMemoryPlayerProfileRepository implements PlayerProfileRepository {
	private readonly values = new Map<string, PlayerProfile>();

	public load(profileKey: string): RepositoryResult<unknown> {
		return { ok: true, value: this.values.get(profileKey) };
	}

	public save(profileKey: string, profile: PlayerProfile): RepositoryResult<void> {
		this.values.set(profileKey, profile);
		return { ok: true, value: undefined };
	}

	public release(profileKey: string, profile: PlayerProfile): RepositoryResult<void> {
		return this.save(profileKey, profile);
	}

	public abandon(_profileKey: string): RepositoryResult<void> {
		return { ok: true, value: undefined };
	}
}
