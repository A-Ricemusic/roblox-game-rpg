import { PlayerProfile } from "shared/player/PlayerProfile";

import { PlayerProfileRepository, RepositoryResult } from "../persistence/PlayerProfileRepository";

export class FakePlayerProfileRepository implements PlayerProfileRepository {
	private readonly values = new Map<string, unknown>();
	private readonly loadResults = new Array<RepositoryResult<unknown>>();
	private readonly saveResults = new Array<RepositoryResult<void>>();
	private readonly renewResults = new Array<RepositoryResult<void>>();
	private readonly releaseResults = new Array<RepositoryResult<void>>();
	private readonly abandonResults = new Array<RepositoryResult<void>>();
	public loadCalls = 0;
	public saveCalls = 0;
	public renewCalls = 0;
	public releaseCalls = 0;
	public abandonCalls = 0;
	public beforeSave?: () => void;

	public seed(profileKey: string, value: unknown): void {
		this.values.set(profileKey, value);
	}

	public getStored(profileKey: string): unknown {
		return this.values.get(profileKey);
	}

	public queueLoadResult(result: RepositoryResult<unknown>): void {
		this.loadResults.push(result);
	}

	public queueSaveResult(result: RepositoryResult<void>): void {
		this.saveResults.push(result);
	}

	public queueRenewResult(result: RepositoryResult<void>): void {
		this.renewResults.push(result);
	}

	public queueReleaseResult(result: RepositoryResult<void>): void {
		this.releaseResults.push(result);
	}

	public queueAbandonResult(result: RepositoryResult<void>): void {
		this.abandonResults.push(result);
	}

	public load(profileKey: string): RepositoryResult<unknown> {
		this.loadCalls += 1;
		return this.loadResults.shift() ?? { ok: true, value: this.values.get(profileKey) };
	}

	public save(profileKey: string, profile: PlayerProfile): RepositoryResult<void> {
		this.saveCalls += 1;
		this.beforeSave?.();
		const result = this.saveResults.shift();
		if (result !== undefined) return result;
		this.values.set(profileKey, profile);
		return { ok: true, value: undefined };
	}

	public renew(_profileKey: string): RepositoryResult<void> {
		this.renewCalls += 1;
		return this.renewResults.shift() ?? { ok: true, value: undefined };
	}

	public release(profileKey: string, profile: PlayerProfile): RepositoryResult<void> {
		this.releaseCalls += 1;
		const result = this.releaseResults.shift();
		if (result !== undefined) return result;
		this.values.set(profileKey, profile);
		return { ok: true, value: undefined };
	}

	public abandon(_profileKey: string): RepositoryResult<void> {
		this.abandonCalls += 1;
		return this.abandonResults.shift() ?? { ok: true, value: undefined };
	}
}
