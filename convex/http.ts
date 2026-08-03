import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { assertValidPlayerProfile, type PlayerProfile } from "./validators";

const http = httpRouter();
const JSON_HEADERS = { "Content-Type": "application/json" };

type JsonRecord = Record<string, unknown>;

class InvalidRequestError extends Error {}
class ServiceConfigurationError extends Error {}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: JsonRecord, key: string): string {
	const value = record[key];
	if (typeof value !== "string") throw new InvalidRequestError(`${key} must be a string.`);
	return value;
}

function readNumber(record: JsonRecord, key: string): number {
	const value = record[key];
	if (typeof value !== "number") throw new InvalidRequestError(`${key} must be a number.`);
	return value;
}

function readProfile(record: JsonRecord): PlayerProfile {
	// Convex validates the generated mutation contract again. This explicit check
	// also enforces integer, identifier, uniqueness, and cross-field invariants.
	const profile = record.profile as PlayerProfile;
	try {
		assertValidPlayerProfile(profile);
	} catch {
		throw new InvalidRequestError("profile must be a valid quest profile.");
	}
	return profile;
}

async function readObject(request: Request): Promise<JsonRecord> {
	const body: unknown = await request.json();
	if (!isRecord(body)) throw new InvalidRequestError("Request body must be a JSON object.");
	return body;
}

function authorized(request: Request): boolean {
	const secret = process.env.ROBLOX_PLAYER_DATABASE_SECRET;
	if (secret === undefined || secret.length < 32)
		throw new ServiceConfigurationError("ROBLOX_PLAYER_DATABASE_SECRET is not configured securely.");
	return request.headers.get("Authorization") === `Bearer ${secret}`;
}

function requestErrorResponse(operation: string, error: unknown): Response {
	console.error(`${operation} profile request failed`, error);
	if (error instanceof InvalidRequestError) return jsonResponse({ error: "invalid_request" }, 400);
	if (error instanceof ServiceConfigurationError) return jsonResponse({ error: "service_unavailable" }, 503);
	return jsonResponse({ error: "service_unavailable" }, 500);
}

http.route({
	path: "/v1/health",
	method: "GET",
	handler: httpAction(async () => jsonResponse({ status: "ok", service: "player-database", version: 1 })),
});

http.route({
	path: "/v1/player-profile/abandon",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			if (!authorized(request)) return jsonResponse({ error: "unauthorized" }, 401);
			const body = await readObject(request);
			const result = await ctx.runMutation(internal.playerProfiles.abandon, {
				profileKey: readString(body, "profileKey"),
				sessionId: readString(body, "sessionId"),
				operationId: readString(body, "operationId"),
			});
			return jsonResponse(result, result.status === "ok" ? 200 : 409);
		} catch (error: unknown) {
			return requestErrorResponse("Abandon", error);
		}
	}),
});

http.route({
	path: "/v1/player-profile/acquire",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			if (!authorized(request)) return jsonResponse({ error: "unauthorized" }, 401);
			const body = await readObject(request);
			const result = await ctx.runMutation(internal.playerProfiles.acquire, {
				profileKey: readString(body, "profileKey"),
				sessionId: readString(body, "sessionId"),
				serverId: readString(body, "serverId"),
				leaseSeconds: readNumber(body, "leaseSeconds"),
			});
			return jsonResponse(result, result.status === "leased" ? 409 : 200);
		} catch (error: unknown) {
			return requestErrorResponse("Acquire", error);
		}
	}),
});

http.route({
	path: "/v1/player-profile/save",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			if (!authorized(request)) return jsonResponse({ error: "unauthorized" }, 401);
			const body = await readObject(request);
			const result = await ctx.runMutation(internal.playerProfiles.save, {
				profileKey: readString(body, "profileKey"),
				sessionId: readString(body, "sessionId"),
				operationId: readString(body, "operationId"),
				expectedRevision: readNumber(body, "expectedRevision"),
				leaseSeconds: readNumber(body, "leaseSeconds"),
				profile: readProfile(body),
			});
			return jsonResponse(result, result.status === "ok" ? 200 : 409);
		} catch (error: unknown) {
			return requestErrorResponse("Save", error);
		}
	}),
});

http.route({
	path: "/v1/player-profile/renew",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			if (!authorized(request)) return jsonResponse({ error: "unauthorized" }, 401);
			const body = await readObject(request);
			const result = await ctx.runMutation(internal.playerProfiles.renew, {
				profileKey: readString(body, "profileKey"),
				sessionId: readString(body, "sessionId"),
				leaseSeconds: readNumber(body, "leaseSeconds"),
			});
			return jsonResponse(result, result.status === "ok" ? 200 : 409);
		} catch (error: unknown) {
			return requestErrorResponse("Renew", error);
		}
	}),
});

http.route({
	path: "/v1/player-profile/release",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			if (!authorized(request)) return jsonResponse({ error: "unauthorized" }, 401);
			const body = await readObject(request);
			const result = await ctx.runMutation(internal.playerProfiles.release, {
				profileKey: readString(body, "profileKey"),
				sessionId: readString(body, "sessionId"),
				operationId: readString(body, "operationId"),
				expectedRevision: readNumber(body, "expectedRevision"),
				profile: readProfile(body),
			});
			return jsonResponse(result, result.status === "ok" ? 200 : 409);
		} catch (error: unknown) {
			return requestErrorResponse("Release", error);
		}
	}),
});

export default http;
