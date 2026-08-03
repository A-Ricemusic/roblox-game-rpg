import { describe, expect, it } from "@rbxts/jest-globals";

import { createEmptyPlayerProfile } from "shared/player/PlayerProfile";

import { FakePlayerProfileRepository } from "server/player/testing/FakePlayerProfileRepository";

import { ResilientPlayerProfileStore } from "./ResilientPlayerProfileStore";

describe("ResilientPlayerProfileStore", () => {
	it("retries aggregate saves and abandon cleanup with capped delays", () => {
		const repository = new FakePlayerProfileRepository();
		const delays = new Array<number>();
		repository.queueSaveResult({ ok: false, error: "busy", retryable: true });
		const store = new ResilientPlayerProfileStore(
			repository,
			{ maxAttempts: 3, baseDelaySeconds: 0.25, maxDelaySeconds: 0.5 },
			(delay) => delays.push(delay),
		);
		expect(store.save("player:1", createEmptyPlayerProfile()).ok).toBe(true);
		expect(delays).toEqual([0.25]);

		repository.queueAbandonResult({ ok: false, error: "timeout", retryable: true });
		expect(store.abandon("player:1").ok).toBe(true);
		expect(repository.abandonCalls).toBe(2);
	});

	it("stops on terminal load failures", () => {
		const repository = new FakePlayerProfileRepository();
		repository.queueLoadResult({ ok: false, error: "auth", retryable: false });
		const store = new ResilientPlayerProfileStore(
			repository,
			{ maxAttempts: 4, baseDelaySeconds: 0, maxDelaySeconds: 0 },
			() => undefined,
		);
		expect(store.load("player:2").ok).toBe(false);
		expect(repository.loadCalls).toBe(1);
	});
});
