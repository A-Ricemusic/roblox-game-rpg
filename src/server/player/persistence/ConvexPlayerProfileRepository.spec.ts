import { describe, expect, it } from "@rbxts/jest-globals";

import { createEmptyPlayerProfile } from "shared/player/PlayerProfile";

import { ConvexHttpResult, ConvexHttpTransport } from "server/quests/persistence/ConvexHttpTransport";

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

function createRepository(transport: FakeTransport): ConvexPlayerProfileRepository {
	let id = 0;
	return new ConvexPlayerProfileRepository(transport, {
		serverId: "server:test",
		leaseSeconds: 180,
		createId: () => `operation:${++id}`,
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
});
