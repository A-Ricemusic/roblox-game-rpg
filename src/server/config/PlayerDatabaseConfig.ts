import { HttpService, RunService } from "@rbxts/services";

import { ConvexHttpTransport, RobloxConvexHttpTransport } from "server/quests/persistence/ConvexHttpTransport";
import { ConvexPlayerProfileRepository } from "server/player/persistence/ConvexPlayerProfileRepository";
import { DataStorePlayerProfileRepository } from "server/player/persistence/DataStorePlayerProfileRepository";
import { InMemoryPlayerProfileRepository } from "server/player/persistence/InMemoryPlayerProfileRepository";
import { PlayerProfileRepository } from "server/player/persistence/PlayerProfileRepository";
import {
	DataStoreQuestProfileRepository,
	PRODUCTION_QUEST_DATA_STORE_NAME,
} from "server/quests/persistence/DataStoreQuestProfileRepository";

export const PLAYER_DATABASE_BACKEND_ATTRIBUTE = "PlayerDatabaseBackend";
export const CONVEX_SITE_URL_ATTRIBUTE = "ConvexSiteUrl";
export const CONVEX_SECRET_NAME_ATTRIBUTE = "ConvexSecretName";
export const MIGRATE_DATASTORE_ATTRIBUTE = "MigratePlayerDataStore";
export const DEFAULT_CONVEX_SECRET_NAME = "CONVEX_PLAYER_DATABASE_KEY";
export const DEFAULT_CONVEX_LEASE_SECONDS = 180;
export const DEVELOPMENT_CONVEX_SITE_URL = "https://prestigious-crab-721.convex.site";
export const PRODUCTION_CONVEX_SITE_URL = "https://grand-basilisk-273.convex.site";

type PlayerDatabaseBackend = "Convex" | "DataStore" | "Memory";

function stringAttribute(name: string): string | undefined {
	const value = game.GetAttribute(name);
	return typeIs(value, "string") && value.size() > 0 ? value : undefined;
}

function backend(): PlayerDatabaseBackend {
	const configured = stringAttribute(PLAYER_DATABASE_BACKEND_ATTRIBUTE);
	if (configured === undefined) return game.GameId === 0 ? "Memory" : "Convex";
	assert(
		configured === "Convex" || configured === "DataStore" || configured === "Memory",
		`${PLAYER_DATABASE_BACKEND_ATTRIBUTE} must be Convex, DataStore, or Memory.`,
	);
	return configured;
}

export function resolveConvexSiteUrl(configured: unknown, isStudio: boolean): string {
	return typeIs(configured, "string") && configured.size() > 0
		? configured
		: isStudio
			? DEVELOPMENT_CONVEX_SITE_URL
			: PRODUCTION_CONVEX_SITE_URL;
}

export function resolveShouldMigrateDataStore(configured: unknown, isStudio: boolean): boolean {
	return typeIs(configured, "boolean") ? configured : !isStudio;
}

export function createPlayerDatabaseRepository(
	transportFactory: (siteUrl: string, authorization: Secret) => ConvexHttpTransport = (siteUrl, authorization) =>
		new RobloxConvexHttpTransport(siteUrl, authorization),
): PlayerProfileRepository {
	const selected = backend();
	if (selected === "Memory") {
		warn("[PlayerDatabase] Using non-persistent in-memory player profiles.");
		return new InMemoryPlayerProfileRepository();
	}
	if (selected === "DataStore") {
		warn("[PlayerDatabase] Using the legacy Roblox DataStore backend.");
		return new DataStorePlayerProfileRepository();
	}

	assert(HttpService.HttpEnabled, "Convex requires Game Settings > Security > Allow HTTP Requests.");
	const isStudio = RunService.IsStudio();
	const siteUrl = resolveConvexSiteUrl(game.GetAttribute(CONVEX_SITE_URL_ATTRIBUTE), isStudio);
	const secretName = stringAttribute(CONVEX_SECRET_NAME_ATTRIBUTE) ?? DEFAULT_CONVEX_SECRET_NAME;
	const authorization = HttpService.GetSecret(secretName).AddPrefix("Bearer ");
	const legacyRepository = resolveShouldMigrateDataStore(game.GetAttribute(MIGRATE_DATASTORE_ATTRIBUTE), isStudio)
		? new DataStoreQuestProfileRepository(PRODUCTION_QUEST_DATA_STORE_NAME)
		: undefined;

	return new ConvexPlayerProfileRepository(transportFactory(siteUrl, authorization), {
		serverId: game.JobId.size() > 0 ? game.JobId : `studio:${game.PlaceId}`,
		leaseSeconds: DEFAULT_CONVEX_LEASE_SECONDS,
		createId: () => HttpService.GenerateGUID(false),
		legacyQuestRepository: legacyRepository,
	});
}
