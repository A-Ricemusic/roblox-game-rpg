import { QuestProfile } from "shared/quests/QuestTypes";

import { QuestProfileRepository, RepositoryResult } from "../persistence/QuestProfileRepository";

export class FakeQuestProfileRepository implements QuestProfileRepository {
	private readonly values = new Map<string, unknown>();
	private readonly queuedLoadResults = new Array<RepositoryResult<unknown>>();
	private readonly queuedSaveResults = new Array<RepositoryResult<void>>();
	private readonly queuedReleaseResults = new Array<RepositoryResult<void>>();

	public loadCalls = 0;
	public saveCalls = 0;
	public releaseCalls = 0;

	public seed(profileKey: string, value: unknown): void {
		this.values.set(profileKey, value);
	}

	public queueLoadResult(result: RepositoryResult<unknown>): void {
		this.queuedLoadResults.push(result);
	}

	public queueSaveResult(result: RepositoryResult<void>): void {
		this.queuedSaveResults.push(result);
	}

	public queueReleaseResult(result: RepositoryResult<void>): void {
		this.queuedReleaseResults.push(result);
	}

	public getStored(profileKey: string): unknown {
		return this.values.get(profileKey);
	}

	public load(profileKey: string): RepositoryResult<unknown> {
		this.loadCalls += 1;
		return this.queuedLoadResults.shift() ?? { ok: true, value: this.values.get(profileKey) };
	}

	public save(profileKey: string, profile: QuestProfile): RepositoryResult<void> {
		this.saveCalls += 1;
		const queued = this.queuedSaveResults.shift();
		if (queued !== undefined) {
			return queued;
		}
		this.values.set(profileKey, profile);
		return { ok: true, value: undefined };
	}

	public release(profileKey: string, profile: QuestProfile): RepositoryResult<void> {
		this.releaseCalls += 1;
		const queued = this.queuedReleaseResults.shift();
		if (queued !== undefined) return queued;
		this.values.set(profileKey, profile);
		return { ok: true, value: undefined };
	}
}
