import { Players, ProximityPromptService } from "@rbxts/services";

import { QUEST_DEFINITIONS } from "shared/quests/QuestDefinitions";
import { assertValidQuestDefinitions } from "shared/quests/QuestDefinitionValidator";

import { CollectibleRegistry, RobloxCollectionTagSource } from "./collectibles/CollectibleRegistry";
import { QuestCollectibleClaimService } from "./collectibles/QuestCollectibleClaimService";
import { DataStoreQuestProfileRepository } from "./quests/persistence/DataStoreQuestProfileRepository";
import { InMemoryQuestProfileRepository } from "./quests/persistence/InMemoryQuestProfileRepository";
import { QuestProfileRepository } from "./quests/persistence/QuestProfileRepository";
import { ResilientQuestProfileStore } from "./quests/persistence/ResilientQuestProfileStore";
import { QuestProfileService } from "./quests/QuestProfileService";
import { getOrCreateQuestRemote, QuestRemoteService } from "./quests/QuestRemoteService";
import { WeaponRuntime } from "./weapons/WeaponRuntime";

const AUTOSAVE_INTERVAL_SECONDS = 60;

function profileKey(player: Player): string {
	return `player:${player.UserId}`;
}

assertValidQuestDefinitions(QUEST_DEFINITIONS);

const repository: QuestProfileRepository =
	game.GameId === 0 ? new InMemoryQuestProfileRepository() : new DataStoreQuestProfileRepository();
if (game.GameId === 0)
	warn("[QuestRuntime] Using non-persistent quest profiles in this unpublished development place.");
const store = new ResilientQuestProfileStore(repository);
const profiles = new QuestProfileService(store, QUEST_DEFINITIONS);
const registry = new CollectibleRegistry(new RobloxCollectionTagSource());
const claims = new QuestCollectibleClaimService(registry, profiles);
const remotes = new QuestRemoteService(getOrCreateQuestRemote(), profiles, QUEST_DEFINITIONS);
const weapons = new WeaponRuntime();
let closing = false;

registry.start();
const remoteConnection = remotes.start(profileKey);
weapons.start();

function loadPlayer(player: Player): void {
	const key = profileKey(player);
	const result = profiles.load(key);
	if (!result.ok) {
		warn(`[QuestRuntime] Failed to load ${key}: ${result.error}`);
		player.Kick("Your quest data could not be loaded safely. Please reconnect.");
		return;
	}
	remotes.sendSnapshot(player, key);
}

function savePlayer(player: Player, unload: boolean): void {
	const key = profileKey(player);
	const result = unload ? profiles.unload(key) : profiles.save(key);
	if (!result.ok) warn(`[QuestRuntime] Failed to save ${key}: ${result.error}`);
}

const playerAddedConnection = Players.PlayerAdded.Connect(loadPlayer);
const playerRemovingConnection = Players.PlayerRemoving.Connect((player) => {
	remotes.forget(profileKey(player));
	savePlayer(player, true);
});
for (const player of Players.GetPlayers()) task.spawn(() => loadPlayer(player));

const promptConnection = ProximityPromptService.PromptTriggered.Connect((prompt, player) => {
	const collectible = registry.findRegisteredAncestor(prompt);
	if (collectible === undefined) return;

	const result = claims.claim(profileKey(player), player.Character, collectible);
	if (result.ok && result.questResult.changes.size() > 0) {
		remotes.sendSnapshot(player, profileKey(player));
	}
});

task.spawn(() => {
	while (!closing) {
		task.wait(AUTOSAVE_INTERVAL_SECONDS);
		if (!closing) {
			for (const player of Players.GetPlayers()) savePlayer(player, false);
		}
	}
});

game.BindToClose(() => {
	closing = true;
	remoteConnection.Disconnect();
	playerAddedConnection.Disconnect();
	playerRemovingConnection.Disconnect();
	promptConnection.Disconnect();
	registry.stop();
	weapons.stop();
	for (const player of Players.GetPlayers()) savePlayer(player, false);
});
