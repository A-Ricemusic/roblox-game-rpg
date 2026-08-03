import { describe, expect, it } from "@rbxts/jest-globals";

import { createEmptyQuestProfile } from "shared/quests/QuestEngine";

import { FakeQuestProfileRepository } from "server/quests/testing/FakeQuestProfileRepository";

import { ConvexHttpResult, ConvexHttpTransport } from "./ConvexHttpTransport";
import { ConvexQuestProfileRepository } from "./ConvexQuestProfileRepository";

class FakeConvexTransport implements ConvexHttpTransport {
	public readonly calls = new Array<{ readonly path: string; readonly body: Readonly<Record<string, unknown>> }>();
	private readonly results = new Array<ConvexHttpResult>();
	public onPost?: (path: string) => void;

	public queue(result: ConvexHttpResult): void {
		this.results.push(result);
	}

	public post(path: string, body: Readonly<Record<string, unknown>>): ConvexHttpResult {
		this.calls.push({ path, body });
		this.onPost?.(path);
		return (
			this.results.shift() ?? {
				ok: false,
				error: "Fake transport has no queued response.",
				retryable: false,
			}
		);
	}
}

function repository(transport: FakeConvexTransport, legacyRepository?: FakeQuestProfileRepository) {
	let nextId = 0;
	return new ConvexQuestProfileRepository(transport, {
		serverId: "server:test",
		leaseSeconds: 180,
		createId: () => `operation:${++nextId}`,
		legacyRepository,
	});
}

function acquireResponse(profile: unknown = createEmptyQuestProfile(), migrationRequired = false): ConvexHttpResult {
	return {
		ok: true,
		statusCode: 200,
		body: { status: "ok", profile, revision: 0, leaseExpiresAt: 999_999, migrationRequired },
	};
}

describe("ConvexQuestProfileRepository", () => {
	it("acquires, saves, and atomically releases a profile with revision checks", () => {
		const transport = new FakeConvexTransport();
		transport.queue(acquireResponse());
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 1, leaseExpiresAt: 999_999 } });
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 2 } });
		const store = repository(transport);
		const profile = createEmptyQuestProfile();

		expect(store.load("player:1").ok).toBe(true);
		expect(store.save("player:1", profile).ok).toBe(true);
		expect(store.release("player:1", profile).ok).toBe(true);
		expect(transport.calls[1].body.expectedRevision).toBe(0);
		expect(transport.calls[2].body.expectedRevision).toBe(1);
		expect(transport.calls[2].path).toBe("/v1/player-profile/release");
	});

	it("reuses an idempotency key after a retryable lost save response", () => {
		const transport = new FakeConvexTransport();
		transport.queue(acquireResponse());
		transport.queue({ ok: false, error: "connection reset", retryable: true });
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 1, leaseExpiresAt: 999_999 } });
		const store = repository(transport);
		const profile = createEmptyQuestProfile();
		store.load("player:2");

		expect(store.save("player:2", profile).ok).toBe(false);
		expect(store.save("player:2", profile).ok).toBe(true);
		expect(transport.calls[1].body.operationId).toBe(transport.calls[2].body.operationId);
	});

	it("settles an uncertain snapshot before saving newer progress", () => {
		const transport = new FakeConvexTransport();
		transport.queue(acquireResponse());
		transport.queue({ ok: false, error: "connection reset", retryable: true });
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 1, leaseExpiresAt: 999_999 } });
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 2, leaseExpiresAt: 999_999 } });
		const store = repository(transport);
		const oldProfile = createEmptyQuestProfile();
		const newProfile = { ...oldProfile, completedQuestIds: ["new_progress"] };
		store.load("player:newer");
		expect(store.save("player:newer", oldProfile).ok).toBe(false);

		expect(store.save("player:newer", newProfile).ok).toBe(true);
		expect(transport.calls[2].body.operationId).toBe(transport.calls[1].body.operationId);
		expect(transport.calls[2].body.profile).toBe(oldProfile);
		expect(transport.calls[3].body.operationId !== transport.calls[2].body.operationId).toBe(true);
		expect(transport.calls[3].body.expectedRevision).toBe(1);
		expect(transport.calls[3].body.profile).toBe(newProfile);
	});

	it("settles an uncertain autosave before releasing the newest profile", () => {
		const transport = new FakeConvexTransport();
		transport.queue(acquireResponse());
		transport.queue({ ok: false, error: "timeout", retryable: true });
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 1, leaseExpiresAt: 999_999 } });
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 2 } });
		const store = repository(transport);
		const oldProfile = createEmptyQuestProfile();
		const newestProfile = { ...oldProfile, completedQuestIds: ["before_disconnect"] };
		store.load("player:release-pending");
		expect(store.save("player:release-pending", oldProfile).ok).toBe(false);

		expect(store.release("player:release-pending", newestProfile).ok).toBe(true);
		expect(transport.calls[2].body.profile).toBe(oldProfile);
		expect(transport.calls[3].body.profile).toBe(newestProfile);
		expect(transport.calls[3].body.expectedRevision).toBe(1);
	});

	it("defers a release that overlaps an in-flight autosave", () => {
		const transport = new FakeConvexTransport();
		transport.queue(acquireResponse());
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 1, leaseExpiresAt: 999_999 } });
		const store = repository(transport);
		const profile = createEmptyQuestProfile();
		store.load("player:overlap");

		let overlappingRelease: ReturnType<typeof store.release> | undefined;
		transport.onPost = (path) => {
			if (path !== "/v1/player-profile/save") return;
			transport.onPost = undefined;
			overlappingRelease = store.release("player:overlap", profile);
		};

		expect(store.save("player:overlap", profile).ok).toBe(true);
		expect(overlappingRelease?.ok).toBe(false);
		if (overlappingRelease !== undefined && !overlappingRelease.ok) {
			expect(overlappingRelease.retryable).toBe(true);
		}
	});

	it("imports a legacy DataStore value while migration is pending", () => {
		const legacy = new FakeQuestProfileRepository();
		const legacyProfile = { schemaVersion: 0, activeQuests: {}, completedQuestIds: [] };
		legacy.seed("player:legacy", legacyProfile);
		const transport = new FakeConvexTransport();
		transport.queue(acquireResponse(createEmptyQuestProfile(), true));

		const loaded = repository(transport, legacy).load("player:legacy");

		expect(loaded.ok).toBe(true);
		if (loaded.ok) expect(loaded.value).toBe(legacyProfile);
		expect(legacy.loadCalls).toBe(1);
	});

	it("keeps the acquisition id stable while retrying a failed legacy read", () => {
		const legacy = new FakeQuestProfileRepository();
		legacy.queueLoadResult({ ok: false, error: "throttled", retryable: true });
		const transport = new FakeConvexTransport();
		transport.queue(acquireResponse(createEmptyQuestProfile(), true));
		transport.queue(acquireResponse(createEmptyQuestProfile(), true));
		const store = repository(transport, legacy);

		expect(store.load("player:legacy-retry").ok).toBe(false);
		expect(store.load("player:legacy-retry").ok).toBe(true);
		expect(transport.calls[0].body.sessionId).toBe(transport.calls[1].body.sessionId);
	});

	it("classifies leases as retryable and stale revisions as terminal", () => {
		const leasedTransport = new FakeConvexTransport();
		leasedTransport.queue({ ok: true, statusCode: 409, body: { status: "leased", retryAfterMs: 5_000 } });
		const leased = repository(leasedTransport).load("player:leased");
		expect(leased.ok).toBe(false);
		if (!leased.ok) expect(leased.retryable).toBe(true);

		const staleTransport = new FakeConvexTransport();
		staleTransport.queue(acquireResponse());
		staleTransport.queue({ ok: true, statusCode: 409, body: { status: "revision_conflict", actualRevision: 8 } });
		const staleStore = repository(staleTransport);
		staleStore.load("player:stale");
		const stale = staleStore.save("player:stale", createEmptyQuestProfile());
		expect(stale.ok).toBe(false);
		if (!stale.ok) expect(stale.retryable).toBe(false);
	});

	it("rejects malformed successful responses", () => {
		const transport = new FakeConvexTransport();
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok" } });

		const result = repository(transport).load("player:malformed");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.retryable).toBe(false);
	});
});
