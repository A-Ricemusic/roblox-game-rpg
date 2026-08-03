import { describe, expect, it } from "@rbxts/jest-globals";

import { createEmptyPlayerProfile } from "shared/player/PlayerProfile";
import { QuestProfile } from "shared/quests/QuestTypes";

import { ConvexHttpResult, ConvexHttpTransport } from "server/quests/persistence/ConvexHttpTransport";
import {
	QuestProfileRepository,
	RepositoryResult as QuestRepositoryResult,
} from "server/quests/persistence/QuestProfileRepository";

import { ConvexPlayerProfileRepository } from "./ConvexPlayerProfileRepository";

class FakeTransport implements ConvexHttpTransport {
	public readonly calls = new Array<{ readonly path: string; readonly body: Readonly<Record<string, unknown>> }>();
	private readonly results = new Array<ConvexHttpResult>();

	public queue(result: ConvexHttpResult): void {
		this.results.push(result);
	}

	public post(path: string, body: Readonly<Record<string, unknown>>): ConvexHttpResult {
		this.calls.push({ path, body });
		return this.results.shift() ?? { ok: false, error: "No fake response.", retryable: false };
	}
}

class FakeLegacyQuestRepository implements QuestProfileRepository {
	private readonly loads = new Array<QuestRepositoryResult<unknown>>();
	public loadCalls = 0;

	public queueLoad(result: QuestRepositoryResult<unknown>): void {
		this.loads.push(result);
	}
	public load(_profileKey: string): QuestRepositoryResult<unknown> {
		this.loadCalls += 1;
		return this.loads.shift() ?? { ok: true, value: undefined };
	}
	public save(_profileKey: string, _profile: QuestProfile): QuestRepositoryResult<void> {
		return { ok: true, value: undefined };
	}
	public release(_profileKey: string, _profile: QuestProfile): QuestRepositoryResult<void> {
		return { ok: true, value: undefined };
	}
}

function createRepository(
	transport: FakeTransport,
	legacyQuestRepository?: QuestProfileRepository,
): ConvexPlayerProfileRepository {
	let id = 0;
	return new ConvexPlayerProfileRepository(transport, {
		serverId: "server:test",
		leaseSeconds: 180,
		createId: () => `operation:${++id}`,
		legacyQuestRepository,
	});
}

function acquired(profile = createEmptyPlayerProfile()): ConvexHttpResult {
	return {
		ok: true,
		statusCode: 200,
		body: { status: "ok", profile, revision: 0, leaseExpiresAt: 999, migrationRequired: false },
	};
}

describe("ConvexPlayerProfileRepository", () => {
	it("acquires, saves all domains, and atomically releases", () => {
		const transport = new FakeTransport();
		transport.queue(acquired());
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 1, leaseExpiresAt: 999 } });
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 2 } });
		const repository = createRepository(transport);
		const profile = createEmptyPlayerProfile();
		expect(repository.load("player:1").ok).toBe(true);
		expect(repository.save("player:1", profile).ok).toBe(true);
		expect(repository.release("player:1", profile).ok).toBe(true);
		expect(transport.calls[1].body.profile).toBe(profile);
		expect(transport.calls[2].path).toBe("/v1/player-profile/release");
	});

	it("renews a clean profile lease without transmitting the aggregate profile", () => {
		const transport = new FakeTransport();
		transport.queue(acquired());
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 0, leaseExpiresAt: 999 } });
		const repository = createRepository(transport);
		repository.load("player:renew");
		expect(repository.renew("player:renew").ok).toBe(true);
		expect(transport.calls[1].path).toBe("/v1/player-profile/renew");
		expect(transport.calls[1].body.profile).toBeUndefined();
	});

	it("reuses idempotency keys after uncertain writes", () => {
		const transport = new FakeTransport();
		transport.queue(acquired());
		transport.queue({ ok: false, error: "reset", retryable: true });
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 1, leaseExpiresAt: 999 } });
		const repository = createRepository(transport);
		const profile = createEmptyPlayerProfile();
		repository.load("player:2");
		expect(repository.save("player:2", profile).ok).toBe(false);
		expect(repository.save("player:2", profile).ok).toBe(true);
		expect(transport.calls[1].body.operationId).toBe(transport.calls[2].body.operationId);
	});

	it("retains the idempotency key when a successful HTTP write has a malformed body", () => {
		const transport = new FakeTransport();
		transport.queue(acquired());
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok" } });
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 1, leaseExpiresAt: 999 } });
		const repository = createRepository(transport);
		const profile = createEmptyPlayerProfile();
		repository.load("player:malformed-save");
		const malformed = repository.save("player:malformed-save", profile);
		expect(malformed.ok).toBe(false);
		if (!malformed.ok) expect(malformed.retryable).toBe(true);
		expect(repository.save("player:malformed-save", profile).ok).toBe(true);
		expect(transport.calls[1].body.operationId).toBe(transport.calls[2].body.operationId);
	});

	it("abandons an acquired invalid profile without saving it", () => {
		const transport = new FakeTransport();
		transport.queue(acquired({ ...createEmptyPlayerProfile(), schemaVersion: 1 }));
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 0 } });
		const repository = createRepository(transport);
		repository.load("player:3");
		expect(repository.abandon("player:3").ok).toBe(true);
		expect(transport.calls[1].path).toBe("/v1/player-profile/abandon");
		expect(repository.save("player:3", createEmptyPlayerProfile()).ok).toBe(false);
	});

	it("reports ownership loss and clears the unusable local session", () => {
		const transport = new FakeTransport();
		transport.queue(acquired());
		transport.queue({ ok: true, statusCode: 409, body: { status: "session_conflict" } });
		const repository = createRepository(transport);
		const profile = createEmptyPlayerProfile();
		repository.load("player:ownership");
		const result = repository.save("player:ownership", profile);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.kind).toBe("OwnershipLost");
		expect(repository.abandon("player:ownership").ok).toBe(true);
		expect(transport.calls).toHaveLength(2);
	});

	it("classifies transient HTTP statuses as retryable and authentication as terminal", () => {
		const transientTransport = new FakeTransport();
		transientTransport.queue({ ok: true, statusCode: 408, body: {} });
		const transient = createRepository(transientTransport).load("player:transient");
		expect(transient.ok).toBe(false);
		if (!transient.ok) expect(transient.retryable).toBe(true);

		const authTransport = new FakeTransport();
		authTransport.queue({ ok: true, statusCode: 401, body: {} });
		const auth = createRepository(authTransport).load("player:auth");
		expect(auth.ok).toBe(false);
		if (!auth.ok) expect(auth.retryable).toBe(false);
	});

	it("abandons a potentially acquired lease after a malformed acquire response", () => {
		const transport = new FakeTransport();
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok" } });
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 0 } });
		const repository = createRepository(transport);
		const result = repository.load("player:malformed-acquire");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.retryable).toBe(true);
		expect(repository.abandon("player:malformed-acquire").ok).toBe(true);
		expect(transport.calls[1].path).toBe("/v1/player-profile/abandon");
		expect(transport.calls[1].body.sessionId).toBe(transport.calls[0].body.sessionId);
	});

	it("retries a legacy read under the same acquired Convex lease", () => {
		const transport = new FakeTransport();
		transport.queue({
			ok: true,
			statusCode: 200,
			body: {
				status: "ok",
				profile: createEmptyPlayerProfile(),
				revision: 0,
				leaseExpiresAt: 999,
				migrationRequired: true,
			},
		});
		const legacy = new FakeLegacyQuestRepository();
		legacy.queueLoad({ ok: false, error: "budget", retryable: true });
		legacy.queueLoad({
			ok: true,
			value: { schemaVersion: 1, activeQuests: {}, completedQuestIds: [] },
		});
		const repository = createRepository(transport, legacy);
		expect(repository.load("player:legacy").ok).toBe(false);
		expect(repository.load("player:legacy").ok).toBe(true);
		expect(legacy.loadCalls).toBe(2);
		expect(transport.calls).toHaveLength(1);
	});

	it("abandons the acquired lease after an exhausted legacy migration read", () => {
		const transport = new FakeTransport();
		transport.queue({
			ok: true,
			statusCode: 200,
			body: {
				status: "ok",
				profile: createEmptyPlayerProfile(),
				revision: 0,
				leaseExpiresAt: 999,
				migrationRequired: true,
			},
		});
		transport.queue({ ok: true, statusCode: 200, body: { status: "ok", revision: 0 } });
		const legacy = new FakeLegacyQuestRepository();
		legacy.queueLoad({ ok: false, error: "legacy unavailable", retryable: false });
		const repository = createRepository(transport, legacy);
		expect(repository.load("player:legacy-failed").ok).toBe(false);
		expect(repository.abandon("player:legacy-failed").ok).toBe(true);
		expect(transport.calls[1].path).toBe("/v1/player-profile/abandon");
	});
});
