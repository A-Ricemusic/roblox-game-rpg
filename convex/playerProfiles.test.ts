import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const questProfile = { schemaVersion: 1 as const, activeQuests: {}, completedQuestIds: [] };
const inventoryProfile = {
	schemaVersion: 1 as const,
	itemQuantities: { hoplite_sword: 1 },
	claimedWorldPickupIds: [],
	equipment: { schemaVersion: 1 as const, weapon: "hoplite_sword" },
};
const profile = { schemaVersion: 1 as const, questProfile, inventoryProfile };
const authorization = "Bearer test-secret-that-is-at-least-thirty-two-characters-long";

describe("player profile transactions", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-02T12:00:00Z"));
	});

	afterEach(() => vi.useRealTimers());

	it("creates a migration-pending profile and blocks a competing live session", async () => {
		const t = convexTest({ schema, modules });
		const acquired = await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:1",
			sessionId: "session:a",
			serverId: "server:a",
			leaseSeconds: 180,
		});
		expect(acquired.status).toBe("ok");
		if (acquired.status === "ok") expect(acquired.migrationRequired).toBe(true);

		const competing = await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:1",
			sessionId: "session:b",
			serverId: "server:b",
			leaseSeconds: 180,
		});
		expect(competing.status).toBe("leased");
	});

	it("acquires a legacy inventory without equipment and accepts its migrated save", async () => {
		const t = convexTest({ schema, modules });
		await t.run(async (ctx) => {
			await ctx.db.insert("playerProfiles", {
				profileKey: "player:legacy-equipment",
				questProfile,
				inventoryProfile: {
					schemaVersion: 1,
					itemQuantities: {},
					claimedWorldPickupIds: [],
				},
				migrationStatus: "complete",
				revision: 4,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		});

		const acquired = await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:legacy-equipment",
			sessionId: "session:legacy",
			serverId: "server:a",
			leaseSeconds: 180,
		});
		expect(acquired.status).toBe("ok");
		if (acquired.status !== "ok") return;
		expect(acquired.profile.inventoryProfile.equipment).toBeUndefined();

		const saved = await t.mutation(internal.playerProfiles.save, {
			profileKey: "player:legacy-equipment",
			sessionId: "session:legacy",
			operationId: "save:migrated-equipment",
			expectedRevision: 4,
			leaseSeconds: 180,
			profile,
		});
		expect(saved).toMatchObject({ status: "ok", revision: 5 });
		const documents = await t.run(async (ctx) => ctx.db.query("playerProfiles").collect());
		expect(documents[0].inventoryProfile?.equipment).toEqual(inventoryProfile.equipment);
	});

	it("allows takeover after lease expiration", async () => {
		const t = convexTest({ schema, modules });
		await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:2",
			sessionId: "session:a",
			serverId: "server:a",
			leaseSeconds: 30,
		});
		vi.advanceTimersByTime(30_001);

		const takeover = await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:2",
			sessionId: "session:b",
			serverId: "server:b",
			leaseSeconds: 30,
		});
		expect(takeover.status).toBe("ok");
	});

	it("saves with optimistic concurrency and deduplicates repeated operations", async () => {
		const t = convexTest({ schema, modules });
		await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:3",
			sessionId: "session:a",
			serverId: "server:a",
			leaseSeconds: 180,
		});
		const args = {
			profileKey: "player:3",
			sessionId: "session:a",
			operationId: "save:one",
			expectedRevision: 0,
			leaseSeconds: 180,
			profile,
		};

		const saved = await t.mutation(internal.playerProfiles.save, args);
		const repeated = await t.mutation(internal.playerProfiles.save, args);
		expect(saved).toEqual(repeated);
		expect(saved).toMatchObject({ status: "ok", revision: 1 });

		const stale = await t.mutation(internal.playerProfiles.save, { ...args, operationId: "save:two" });
		expect(stale).toEqual({ status: "revision_conflict", actualRevision: 1 });
		const documents = await t.run(async (ctx) => ctx.db.query("playerProfiles").collect());
		expect(documents[0].migrationStatus).toBe("complete");
	});

	it("renews a lease without rewriting the aggregate profile or revision", async () => {
		const t = convexTest({ schema, modules });
		await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:renew",
			sessionId: "session:a",
			serverId: "server:a",
			leaseSeconds: 30,
		});
		vi.advanceTimersByTime(10_000);
		const renewed = await t.mutation(internal.playerProfiles.renew, {
			profileKey: "player:renew",
			sessionId: "session:a",
			leaseSeconds: 180,
		});
		expect(renewed).toMatchObject({ status: "ok", revision: 0 });
		const documents = await t.run(async (ctx) => ctx.db.query("playerProfiles").collect());
		expect(documents[0].revision).toBe(0);
		expect(documents[0].questProfile).toEqual(questProfile);
		expect(documents[0].inventoryProfile).toEqual(inventoryProfile);
	});

	it("atomically persists and releases the owning session", async () => {
		const t = convexTest({ schema, modules });
		await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:4",
			sessionId: "session:a",
			serverId: "server:a",
			leaseSeconds: 180,
		});
		const released = await t.mutation(internal.playerProfiles.release, {
			profileKey: "player:4",
			sessionId: "session:a",
			operationId: "release:one",
			expectedRevision: 0,
			profile,
		});
		expect(released).toEqual({ status: "ok", revision: 1 });

		const reacquired = await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:4",
			sessionId: "session:b",
			serverId: "server:b",
			leaseSeconds: 180,
		});
		expect(reacquired.status).toBe("ok");
		if (reacquired.status === "ok") expect(reacquired.migrationRequired).toBe(false);
	});

	it("rejects writes from a superseded session", async () => {
		const t = convexTest({ schema, modules });
		await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:5",
			sessionId: "session:a",
			serverId: "server:a",
			leaseSeconds: 30,
		});
		vi.advanceTimersByTime(30_001);
		await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:5",
			sessionId: "session:b",
			serverId: "server:b",
			leaseSeconds: 30,
		});

		const save = await t.mutation(internal.playerProfiles.save, {
			profileKey: "player:5",
			sessionId: "session:a",
			operationId: "save:old",
			expectedRevision: 0,
			leaseSeconds: 180,
			profile,
		});
		expect(save).toEqual({ status: "session_conflict" });
	});

	it("validates identifiers and lease bounds", async () => {
		const t = convexTest({ schema, modules });
		await expect(
			t.mutation(internal.playerProfiles.acquire, {
				profileKey: "",
				sessionId: "session:a",
				serverId: "server:a",
				leaseSeconds: 180,
			}),
		).rejects.toThrow("profileKey");
		await expect(
			t.mutation(internal.playerProfiles.acquire, {
				profileKey: "player:invalid-lease",
				sessionId: "session:a",
				serverId: "server:a",
				leaseSeconds: 29,
			}),
		).rejects.toThrow("leaseSeconds");
	});

	it("rejects quest profiles with invalid semantic invariants", async () => {
		const t = convexTest({ schema, modules });
		await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:invalid-profile",
			sessionId: "session:a",
			serverId: "server:a",
			leaseSeconds: 180,
		});
		const activeQuest = {
			questId: "different-key",
			definitionVersion: 1,
			status: "Active" as const,
			currentStageIndex: 0,
			objectiveProgress: {},
			startedAt: 1,
			updatedAt: 1,
		};

		await expect(
			t.mutation(internal.playerProfiles.save, {
				profileKey: "player:invalid-profile",
				sessionId: "session:a",
				operationId: "save:invalid-profile",
				expectedRevision: 0,
				leaseSeconds: 180,
				profile: {
					schemaVersion: 1,
					questProfile: { schemaVersion: 1, activeQuests: { quest: activeQuest }, completedQuestIds: [] },
					inventoryProfile,
				},
			}),
		).rejects.toThrow("mismatched questId");
	});

	it("deduplicates releases and rejects operation id reuse across operation kinds", async () => {
		const t = convexTest({ schema, modules });
		await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:operation-kind",
			sessionId: "session:a",
			serverId: "server:a",
			leaseSeconds: 180,
		});
		const releaseArgs = {
			profileKey: "player:operation-kind",
			sessionId: "session:a",
			operationId: "operation:shared",
			expectedRevision: 0,
			profile,
		};
		const released = await t.mutation(internal.playerProfiles.release, releaseArgs);
		expect(await t.mutation(internal.playerProfiles.release, releaseArgs)).toEqual(released);
		await expect(
			t.mutation(internal.playerProfiles.save, {
				...releaseArgs,
				leaseSeconds: 180,
			}),
		).rejects.toThrow("different operation");
	});

	it("abandons an invalid loaded profile without mutating its data or revision", async () => {
		const t = convexTest({ schema, modules });
		await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:abandon",
			sessionId: "session:a",
			serverId: "server:a",
			leaseSeconds: 180,
		});
		const abandoned = await t.mutation(internal.playerProfiles.abandon, {
			profileKey: "player:abandon",
			sessionId: "session:a",
			operationId: "abandon:one",
		});
		expect(abandoned).toEqual({ status: "ok", revision: 0 });
		const reacquired = await t.mutation(internal.playerProfiles.acquire, {
			profileKey: "player:abandon",
			sessionId: "session:b",
			serverId: "server:b",
			leaseSeconds: 180,
		});
		expect(reacquired.status).toBe("ok");
		if (reacquired.status === "ok") {
			expect(reacquired.revision).toBe(0);
			expect(reacquired.migrationRequired).toBe(true);
		}
	});
});

describe("player profile HTTP API", () => {
	beforeEach(() => {
		process.env.ROBLOX_PLAYER_DATABASE_SECRET = authorization.slice("Bearer ".length);
	});

	afterEach(() => {
		delete process.env.ROBLOX_PLAYER_DATABASE_SECRET;
	});

	it("exposes health without exposing protected player operations", async () => {
		const t = convexTest({ schema, modules });
		const health = await t.fetch("/v1/health");
		expect(health.status).toBe(200);
		expect(await health.json()).toEqual({ status: "ok", service: "player-database", version: 1 });

		const unauthorized = await t.fetch("/v1/player-profile/acquire", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				profileKey: "player:http",
				sessionId: "session:http",
				serverId: "server:http",
				leaseSeconds: 180,
			}),
		});
		expect(unauthorized.status).toBe(401);
	});

	it("acquires, saves, and releases through authenticated endpoints", async () => {
		const t = convexTest({ schema, modules });
		const headers = { "Content-Type": "application/json", Authorization: authorization };
		const acquire = await t.fetch("/v1/player-profile/acquire", {
			method: "POST",
			headers,
			body: JSON.stringify({
				profileKey: "player:http-flow",
				sessionId: "session:http",
				serverId: "server:http",
				leaseSeconds: 180,
			}),
		});
		expect(acquire.status).toBe(200);

		const save = await t.fetch("/v1/player-profile/save", {
			method: "POST",
			headers,
			body: JSON.stringify({
				profileKey: "player:http-flow",
				sessionId: "session:http",
				operationId: "save:http",
				expectedRevision: 0,
				leaseSeconds: 180,
				profile,
			}),
		});
		expect(save.status).toBe(200);
		expect(await save.json()).toMatchObject({ status: "ok", revision: 1 });

		const release = await t.fetch("/v1/player-profile/release", {
			method: "POST",
			headers,
			body: JSON.stringify({
				profileKey: "player:http-flow",
				sessionId: "session:http",
				operationId: "release:http",
				expectedRevision: 1,
				profile,
			}),
		});
		expect(release.status).toBe(200);
		expect(await release.json()).toEqual({ status: "ok", revision: 2 });
	});

	it("rejects malformed JSON contracts without leaking backend errors", async () => {
		const t = convexTest({ schema, modules });
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const response = await t.fetch("/v1/player-profile/acquire", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: authorization },
			body: JSON.stringify({ profileKey: 123 }),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "invalid_request" });
		expect(errorSpy).toHaveBeenCalledOnce();
		errorSpy.mockRestore();
	});

	it("rejects semantically invalid profiles as malformed requests", async () => {
		const t = convexTest({ schema, modules });
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const response = await t.fetch("/v1/player-profile/save", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: authorization },
			body: JSON.stringify({
				profileKey: "player:invalid-http-profile",
				sessionId: "session:http",
				operationId: "save:http",
				expectedRevision: 0,
				leaseSeconds: 180,
				profile: {
					schemaVersion: 1,
					questProfile: {
						schemaVersion: 1,
						activeQuests: {},
						completedQuestIds: ["duplicate", "duplicate"],
					},
					inventoryProfile,
				},
			}),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "invalid_request" });
		expect(errorSpy).toHaveBeenCalledOnce();
		errorSpy.mockRestore();
	});

	it("maps lease and write conflicts to HTTP 409", async () => {
		const t = convexTest({ schema, modules });
		const headers = { "Content-Type": "application/json", Authorization: authorization };
		const acquisition = {
			profileKey: "player:http-conflict",
			sessionId: "session:a",
			serverId: "server:a",
			leaseSeconds: 180,
		};
		expect(
			(
				await t.fetch("/v1/player-profile/acquire", {
					method: "POST",
					headers,
					body: JSON.stringify(acquisition),
				})
			).status,
		).toBe(200);
		expect(
			(
				await t.fetch("/v1/player-profile/acquire", {
					method: "POST",
					headers,
					body: JSON.stringify({ ...acquisition, sessionId: "session:b" }),
				})
			).status,
		).toBe(409);

		const staleRelease = await t.fetch("/v1/player-profile/release", {
			method: "POST",
			headers,
			body: JSON.stringify({
				profileKey: acquisition.profileKey,
				sessionId: acquisition.sessionId,
				operationId: "release:stale",
				expectedRevision: 99,
				profile,
			}),
		});
		expect(staleRelease.status).toBe(409);
	});

	it("fails closed when the deployment secret is missing", async () => {
		delete process.env.ROBLOX_PLAYER_DATABASE_SECRET;
		const t = convexTest({ schema, modules });
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const response = await t.fetch("/v1/player-profile/acquire", { method: "POST" });
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: "service_unavailable" });
		expect(errorSpy).toHaveBeenCalledOnce();
		errorSpy.mockRestore();
	});
});
