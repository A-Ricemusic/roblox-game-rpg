import { HttpService } from "@rbxts/services";

import { ConvexHttpTransport, RobloxConvexHttpTransport } from "server/quests/persistence/ConvexHttpTransport";
import { ConvexQuestProfileRepository } from "server/quests/persistence/ConvexQuestProfileRepository";
import {
	DataStoreQuestProfileRepository,
	PRODUCTION_QUEST_DATA_STORE_NAME,
} from "server/quests/persistence/DataStoreQuestProfileRepository";
import { InMemoryQuestProfileRepository } from "server/quests/persistence/InMemoryQuestProfileRepository";
import { QuestProfileRepository } from "server/quests/persistence/QuestProfileRepository";

export const PLAYER_DATABASE_BACKEND_ATTRIBUTE = "PlayerDatabaseBackend";
export const CONVEX_SITE_URL_ATTRIBUTE = "ConvexSiteUrl";
export const CONVEX_SECRET_NAME_ATTRIBUTE = "ConvexSecretName";
export const MIGRATE_DATASTORE_ATTRIBUTE = "MigratePlayerDataStore";
export const DEFAULT_CONVEX_SECRET_NAME = "CONVEX_PLAYER_DATABASE_KEY";
export const DEFAULT_CONVEX_LEASE_SECONDS = 180;

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

function shouldMigrateDataStore(): boolean {
	const configured = game.GetAttribute(MIGRATE_DATASTORE_ATTRIBUTE);
	return configured === undefined ? true : configured === true;
}

export function createPlayerDatabaseRepository(
	transportFactory: (siteUrl: string, authorization: Secret) => ConvexHttpTransport = (siteUrl, authorization) =>
		new RobloxConvexHttpTransport(siteUrl, authorization),
): QuestProfileRepository {
	const selected = backend();
	if (selected === "Memory") {
		warn("[PlayerDatabase] Using non-persistent in-memory player profiles.");
		return new InMemoryQuestProfileRepository();
	}
	if (selected === "DataStore") {
		warn("[PlayerDatabase] Using the legacy Roblox DataStore backend.");
		return new DataStoreQuestProfileRepository();
	}

	assert(HttpService.HttpEnabled, "Convex requires Game Settings > Security > Allow HTTP Requests.");
	const siteUrl = stringAttribute(CONVEX_SITE_URL_ATTRIBUTE);
	assert(
		siteUrl !== undefined,
		`${CONVEX_SITE_URL_ATTRIBUTE} must contain the deployment's https://*.convex.site URL.`,
	);
	const secretName = stringAttribute(CONVEX_SECRET_NAME_ATTRIBUTE) ?? DEFAULT_CONVEX_SECRET_NAME;
	const authorization = HttpService.GetSecret(secretName).AddPrefix("Bearer ");
	const legacyRepository = shouldMigrateDataStore()
		? new DataStoreQuestProfileRepository(PRODUCTION_QUEST_DATA_STORE_NAME)
		: undefined;

	return new ConvexQuestProfileRepository(transportFactory(siteUrl, authorization), {
		serverId: game.JobId.size() > 0 ? game.JobId : `studio:${game.PlaceId}`,
		leaseSeconds: DEFAULT_CONVEX_LEASE_SECONDS,
		createId: () => HttpService.GenerateGUID(false),
		legacyRepository,
	});
}
