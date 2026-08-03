import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import {
	acquireResultValidator,
	assertValidQuestProfile,
	questProfileValidator,
	writeResultValidator,
} from "./validators";

const MIN_LEASE_SECONDS = 30;
const MAX_LEASE_SECONDS = 10 * 60;
const MAX_PROFILE_KEY_LENGTH = 80;
const MAX_IDENTIFIER_LENGTH = 160;

function emptyQuestProfile() {
	return {
		schemaVersion: 1 as const,
		activeQuests: {},
		completedQuestIds: [],
	};
}

function assertIdentifier(value: string, label: string, maxLength = MAX_IDENTIFIER_LENGTH): void {
	if (value.length === 0 || value.length > maxLength) {
		throw new Error(`${label} must contain between 1 and ${maxLength} characters.`);
	}
}

function leaseDurationMs(leaseSeconds: number): number {
	if (!Number.isInteger(leaseSeconds) || leaseSeconds < MIN_LEASE_SECONDS || leaseSeconds > MAX_LEASE_SECONDS) {
		throw new Error(`leaseSeconds must be an integer from ${MIN_LEASE_SECONDS} through ${MAX_LEASE_SECONDS}.`);
	}
	return leaseSeconds * 1000;
}

export const acquire = internalMutation({
	args: {
		profileKey: v.string(),
		sessionId: v.string(),
		serverId: v.string(),
		leaseSeconds: v.number(),
	},
	returns: acquireResultValidator,
	handler: async (ctx, args) => {
		assertIdentifier(args.profileKey, "profileKey", MAX_PROFILE_KEY_LENGTH);
		assertIdentifier(args.sessionId, "sessionId");
		assertIdentifier(args.serverId, "serverId");
		const now = Date.now();
		const expiresAt = now + leaseDurationMs(args.leaseSeconds);
		const existing = await ctx.db
			.query("playerProfiles")
			.withIndex("by_profile_key", (query) => query.eq("profileKey", args.profileKey))
			.unique();

		if (existing === null) {
			const profile = emptyQuestProfile();
			await ctx.db.insert("playerProfiles", {
				profileKey: args.profileKey,
				questProfile: profile,
				migrationStatus: "pending",
				revision: 0,
				session: { id: args.sessionId, serverId: args.serverId, acquiredAt: now, expiresAt },
				createdAt: now,
				updatedAt: now,
			});
			return {
				status: "ok" as const,
				profile,
				revision: 0,
				leaseExpiresAt: expiresAt,
				migrationRequired: true,
			};
		}

		if (
			existing.session !== undefined &&
			existing.session.id !== args.sessionId &&
			existing.session.expiresAt > now
		) {
			return { status: "leased" as const, retryAfterMs: existing.session.expiresAt - now };
		}

		const acquiredAt = existing.session?.id === args.sessionId ? existing.session.acquiredAt : now;
		await ctx.db.patch(existing._id, {
			session: { id: args.sessionId, serverId: args.serverId, acquiredAt, expiresAt },
			updatedAt: now,
		});
		return {
			status: "ok" as const,
			profile: existing.questProfile,
			revision: existing.revision,
			leaseExpiresAt: expiresAt,
			migrationRequired: existing.migrationStatus === "pending",
		};
	},
});

export const save = internalMutation({
	args: {
		profileKey: v.string(),
		sessionId: v.string(),
		operationId: v.string(),
		expectedRevision: v.number(),
		leaseSeconds: v.number(),
		profile: questProfileValidator,
	},
	returns: writeResultValidator,
	handler: async (ctx, args) => {
		assertIdentifier(args.profileKey, "profileKey", MAX_PROFILE_KEY_LENGTH);
		assertIdentifier(args.sessionId, "sessionId");
		assertIdentifier(args.operationId, "operationId");
		assertValidQuestProfile(args.profile);
		const now = Date.now();
		const expiresAt = now + leaseDurationMs(args.leaseSeconds);
		const existing = await ctx.db
			.query("playerProfiles")
			.withIndex("by_profile_key", (query) => query.eq("profileKey", args.profileKey))
			.unique();
		if (existing?.lastOperation?.id === args.operationId) {
			if (existing.lastOperation.kind !== "save") {
				throw new Error("operationId was already used for a different operation.");
			}
			if (existing.session?.id !== args.sessionId) return { status: "session_conflict" as const };
			await ctx.db.patch(existing._id, {
				session: { ...existing.session, expiresAt },
				updatedAt: now,
			});
			return { status: "ok" as const, revision: existing.lastOperation.revision, leaseExpiresAt: expiresAt };
		}
		if (existing === null || existing.session?.id !== args.sessionId)
			return { status: "session_conflict" as const };
		if (existing.revision !== args.expectedRevision) {
			return { status: "revision_conflict" as const, actualRevision: existing.revision };
		}

		const revision = existing.revision + 1;
		await ctx.db.patch(existing._id, {
			questProfile: args.profile,
			migrationStatus: "complete",
			revision,
			session: { ...existing.session, expiresAt },
			lastOperation: { id: args.operationId, kind: "save", revision },
			updatedAt: now,
		});
		return { status: "ok" as const, revision, leaseExpiresAt: expiresAt };
	},
});

export const release = internalMutation({
	args: {
		profileKey: v.string(),
		sessionId: v.string(),
		operationId: v.string(),
		expectedRevision: v.number(),
		profile: questProfileValidator,
	},
	returns: writeResultValidator,
	handler: async (ctx, args) => {
		assertIdentifier(args.profileKey, "profileKey", MAX_PROFILE_KEY_LENGTH);
		assertIdentifier(args.sessionId, "sessionId");
		assertIdentifier(args.operationId, "operationId");
		assertValidQuestProfile(args.profile);
		const now = Date.now();
		const existing = await ctx.db
			.query("playerProfiles")
			.withIndex("by_profile_key", (query) => query.eq("profileKey", args.profileKey))
			.unique();
		if (existing?.lastOperation?.id === args.operationId) {
			if (existing.lastOperation.kind !== "release") {
				throw new Error("operationId was already used for a different operation.");
			}
			return { status: "ok" as const, revision: existing.lastOperation.revision };
		}
		if (existing === null || existing.session?.id !== args.sessionId)
			return { status: "session_conflict" as const };
		if (existing.revision !== args.expectedRevision) {
			return { status: "revision_conflict" as const, actualRevision: existing.revision };
		}

		const revision = existing.revision + 1;
		await ctx.db.patch(existing._id, {
			questProfile: args.profile,
			migrationStatus: "complete",
			revision,
			session: undefined,
			lastOperation: { id: args.operationId, kind: "release", revision },
			updatedAt: now,
		});
		return { status: "ok" as const, revision };
	},
});
