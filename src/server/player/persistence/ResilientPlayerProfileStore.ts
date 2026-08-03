import { PlayerProfile } from "shared/player/PlayerProfile";

import { PlayerProfileRepository, RepositoryResult } from "./PlayerProfileRepository";

export interface RetryPolicy {
	readonly maxAttempts: number;
	readonly baseDelaySeconds: number;
	readonly maxDelaySeconds: number;
}

export type RetrySleeper = (delaySeconds: number) => void;

export const DEFAULT_PLAYER_PROFILE_RETRY_POLICY: RetryPolicy = {
	maxAttempts: 4,
	baseDelaySeconds: 0.5,
	maxDelaySeconds: 4,
};

export class ResilientPlayerProfileStore {
	public constructor(
		private readonly repository: PlayerProfileRepository,
		private readonly policy: RetryPolicy = DEFAULT_PLAYER_PROFILE_RETRY_POLICY,
		private readonly sleep: RetrySleeper = task.wait,
	) {
		assert(policy.maxAttempts >= 1 && math.floor(policy.maxAttempts) === policy.maxAttempts);
		assert(policy.baseDelaySeconds >= 0 && policy.baseDelaySeconds < math.huge);
		assert(policy.maxDelaySeconds >= 0 && policy.maxDelaySeconds < math.huge);
	}

	public load(profileKey: string): RepositoryResult<unknown> {
		return this.withRetry(() => this.repository.load(profileKey));
	}

	public save(profileKey: string, profile: PlayerProfile): RepositoryResult<void> {
		return this.withRetry(() => this.repository.save(profileKey, profile));
	}

	public release(profileKey: string, profile: PlayerProfile): RepositoryResult<void> {
		return this.withRetry(() => this.repository.release(profileKey, profile));
	}

	public abandon(profileKey: string): RepositoryResult<void> {
		return this.withRetry(() => this.repository.abandon(profileKey));
	}

	private withRetry<T>(operation: () => RepositoryResult<T>): RepositoryResult<T> {
		let result = operation();
		for (let attempt = 2; !result.ok && result.retryable && attempt <= this.policy.maxAttempts; attempt++) {
			const delay = math.min(this.policy.maxDelaySeconds, this.policy.baseDelaySeconds * 2 ** (attempt - 2));
			this.sleep(delay);
			result = operation();
		}
		return result;
	}
}
