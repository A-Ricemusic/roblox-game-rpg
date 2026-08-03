import { describe, expect, it } from "@rbxts/jest-globals";

import { createEmptyQuestProfile } from "shared/quests/QuestEngine";

import { FakeQuestProfileRepository } from "server/quests/testing/FakeQuestProfileRepository";

import { ResilientQuestProfileStore } from "./ResilientQuestProfileStore";

const TEST_POLICY = { maxAttempts: 4, baseDelaySeconds: 0.25, maxDelaySeconds: 0.5 } as const;

describe("ResilientQuestProfileStore", () => {
	it("retries retryable saves with capped exponential delays", () => {
		const repository = new FakeQuestProfileRepository();
		const delays = new Array<number>();
		repository.queueSaveResult({ ok: false, error: "throttled", retryable: true });
		repository.queueSaveResult({ ok: false, error: "busy", retryable: true });
		const store = new ResilientQuestProfileStore(repository, TEST_POLICY, (delay) => delays.push(delay));

		const result = store.save("player:1", createEmptyQuestProfile());

		expect(result.ok).toBe(true);
		expect(repository.saveCalls).toBe(3);
		expect(delays).toEqual([0.25, 0.5]);
	});

	it("stops immediately on non-retryable failures", () => {
		const repository = new FakeQuestProfileRepository();
		const delays = new Array<number>();
		repository.queueLoadResult({ ok: false, error: "invalid key", retryable: false });
		const store = new ResilientQuestProfileStore(repository, TEST_POLICY, (delay) => delays.push(delay));

		const result = store.load("bad key");

		expect(result.ok).toBe(false);
		expect(repository.loadCalls).toBe(1);
		expect(delays).toHaveLength(0);
	});

	it("returns the final failure after exhausting its attempt budget", () => {
		const repository = new FakeQuestProfileRepository();
		for (let index = 0; index < TEST_POLICY.maxAttempts; index++) {
			repository.queueSaveResult({ ok: false, error: `failure ${index}`, retryable: true });
		}
		const store = new ResilientQuestProfileStore(repository, TEST_POLICY, () => undefined);

		const result = store.save("player:2", createEmptyQuestProfile());

		expect(result.ok).toBe(false);
		expect(repository.saveCalls).toBe(TEST_POLICY.maxAttempts);
		if (!result.ok) {
			expect(result.error).toBe("failure 3");
		}
	});

	it("rejects invalid retry policies at construction time", () => {
		const repository = new FakeQuestProfileRepository();
		expect(
			() =>
				new ResilientQuestProfileStore(repository, { maxAttempts: 0, baseDelaySeconds: 0, maxDelaySeconds: 0 }),
		).toThrow();
		expect(
			() =>
				new ResilientQuestProfileStore(repository, {
					maxAttempts: 1,
					baseDelaySeconds: -1,
					maxDelaySeconds: 0,
				}),
		).toThrow();
	});
});
