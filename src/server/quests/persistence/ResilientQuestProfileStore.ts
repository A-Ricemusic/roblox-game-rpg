import { QuestProfile } from "shared/quests/QuestTypes";

import { QuestProfileRepository, RepositoryResult } from "./QuestProfileRepository";

export interface RetryPolicy {
	readonly maxAttempts: number;
	readonly baseDelaySeconds: number;
	readonly maxDelaySeconds: number;
}

export type RetrySleeper = (delaySeconds: number) => void;

export const DEFAULT_QUEST_RETRY_POLICY: RetryPolicy = {
	maxAttempts: 4,
	baseDelaySeconds: 0.5,
	maxDelaySeconds: 4,
};

export class ResilientQuestProfileStore {
	public constructor(
		private readonly repository: QuestProfileRepository,
		private readonly policy: RetryPolicy = DEFAULT_QUEST_RETRY_POLICY,
		private readonly sleep: RetrySleeper = task.wait,
	) {
		assert(
			policy.maxAttempts >= 1 && math.floor(policy.maxAttempts) === policy.maxAttempts,
			"Retry policy must allow a positive integer number of attempts.",
		);
		assert(
			policy.baseDelaySeconds >= 0 && policy.baseDelaySeconds < math.huge,
			"Retry base delay must be finite and non-negative.",
		);
		assert(
			policy.maxDelaySeconds >= 0 && policy.maxDelaySeconds < math.huge,
			"Retry maximum delay must be finite and non-negative.",
		);
	}

	public load(profileKey: string): RepositoryResult<unknown> {
		return this.withRetry(() => this.repository.load(profileKey));
	}

	public save(profileKey: string, profile: QuestProfile): RepositoryResult<void> {
		return this.withRetry(() => this.repository.save(profileKey, profile));
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
