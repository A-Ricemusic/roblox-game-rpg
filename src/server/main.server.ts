import { Players, ProximityPromptService } from "@rbxts/services";

import { QUEST_DEFINITIONS } from "shared/quests/QuestDefinitions";
import { assertValidQuestDefinitions } from "shared/quests/QuestDefinitionValidator";
import { INVENTORY_ITEM_DEFINITIONS } from "shared/inventory/InventoryDefinitions";
import { assertValidInventoryDefinitions } from "shared/inventory/InventoryDefinitionValidator";

import { CollectibleRegistry, RobloxCollectionTagSource } from "./collectibles/CollectibleRegistry";
import { QuestCollectibleClaimService } from "./collectibles/QuestCollectibleClaimService";
import { createPlayerDatabaseRepository } from "./config/PlayerDatabaseConfig";
import { InventoryProfileService } from "./inventory/InventoryProfileService";
import { InventoryQuestBridge } from "./inventory/InventoryQuestBridge";
import { getOrCreateInventoryRemote, InventoryRemoteService } from "./inventory/InventoryRemoteService";
import { WorldPickupClaimService } from "./inventory/WorldPickupClaimService";
import { RobloxInventoryPickupTagSource, WorldPickupRegistry } from "./inventory/WorldPickupRegistry";
import { PlayerProfileService } from "./player/PlayerProfileService";
import { ResilientPlayerProfileStore } from "./player/persistence/ResilientPlayerProfileStore";
import { QuestProfileService } from "./quests/QuestProfileService";
import { getOrCreateQuestRemote, QuestRemoteService } from "./quests/QuestRemoteService";
import { WeaponRuntime } from "./weapons/WeaponRuntime";

const AUTOSAVE_INTERVAL_SECONDS = 60;

function profileKey(player: Player): string {
	return `player:${player.UserId}`;
}

assertValidQuestDefinitions(QUEST_DEFINITIONS);
assertValidInventoryDefinitions(INVENTORY_ITEM_DEFINITIONS);

const repository = createPlayerDatabaseRepository();
const store = new ResilientPlayerProfileStore(repository);
const playerProfiles = new PlayerProfileService(store, QUEST_DEFINITIONS, INVENTORY_ITEM_DEFINITIONS);
const profiles = new QuestProfileService(playerProfiles, QUEST_DEFINITIONS);
const inventories = new InventoryProfileService(playerProfiles, INVENTORY_ITEM_DEFINITIONS);
const inventoryQuestBridge = new InventoryQuestBridge(profiles);
const registry = new CollectibleRegistry(new RobloxCollectionTagSource());
const claims = new QuestCollectibleClaimService(registry, profiles);
const remotes = new QuestRemoteService(getOrCreateQuestRemote(), profiles, QUEST_DEFINITIONS);
const pickupRegistry = new WorldPickupRegistry(new RobloxInventoryPickupTagSource());
const pickupClaims = new WorldPickupClaimService(pickupRegistry, inventories);
const inventoryRemotes = new InventoryRemoteService(
	getOrCreateInventoryRemote(),
	inventories,
	INVENTORY_ITEM_DEFINITIONS,
);
const weapons = new WeaponRuntime();
const loadingProfileKeys = new Set<string>();
let closing = false;

registry.start();
pickupRegistry.start();
const remoteConnection = remotes.start(profileKey);
const inventoryRemoteConnection = inventoryRemotes.start(profileKey);
weapons.start();

function loadPlayer(player: Player): void {
	const key = profileKey(player);
	if (playerProfiles.get(key) !== undefined) {
		if (player.Parent === Players) {
			remotes.sendSnapshot(player, key);
			inventoryRemotes.sendSnapshot(player, key);
		}
		return;
	}
	if (loadingProfileKeys.has(key)) return;
	loadingProfileKeys.add(key);
	const result = playerProfiles.load(key);
	loadingProfileKeys.delete(key);
	const currentPlayer = Players.GetPlayerByUserId(player.UserId);
	if (!result.ok) {
		warn(`[PlayerRuntime] Failed to load ${key}: ${result.error}`);
		currentPlayer?.Kick("Your player data could not be loaded safely. Please reconnect.");
		return;
	}
	if (closing || currentPlayer === undefined) {
		const released = playerProfiles.unload(key);
		if (!released.ok) warn(`[PlayerRuntime] Failed to release disconnected ${key}: ${released.error}`);
		return;
	}
	remotes.sendSnapshot(currentPlayer, key);
	inventoryRemotes.sendSnapshot(currentPlayer, key);
}

function savePlayer(player: Player, unload: boolean): void {
	const key = profileKey(player);
	if (playerProfiles.get(key) === undefined) return;
	const result = unload ? playerProfiles.unload(key) : playerProfiles.save(key);
	if (!result.ok) warn(`[PlayerRuntime] Failed to save ${key}: ${result.error}`);
}

const playerAddedConnection = Players.PlayerAdded.Connect(loadPlayer);
const playerRemovingConnection = Players.PlayerRemoving.Connect((player) => {
	remotes.forget(profileKey(player));
	inventoryRemotes.forget(profileKey(player));
	savePlayer(player, true);
});
for (const player of Players.GetPlayers()) task.spawn(() => loadPlayer(player));

const promptConnection = ProximityPromptService.PromptTriggered.Connect((prompt, player) => {
	const pickup = pickupRegistry.findRegisteredAncestor(prompt);
	if (pickup !== undefined) {
		const result = pickupClaims.claim(profileKey(player), player.Character, pickup);
		if (result.ok) {
			inventoryRemotes.sendSnapshot(player, profileKey(player));
			const questResult = inventoryQuestBridge.itemGranted(profileKey(player), result.event);
			if (questResult !== undefined && questResult.changes.size() > 0) {
				remotes.sendSnapshot(player, profileKey(player));
			}
		}
		return;
	}
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
	inventoryRemoteConnection.Disconnect();
	playerAddedConnection.Disconnect();
	playerRemovingConnection.Disconnect();
	promptConnection.Disconnect();
	registry.stop();
	pickupRegistry.stop();
	weapons.stop();
	for (const player of Players.GetPlayers()) {
		if (playerProfiles.get(profileKey(player)) !== undefined) savePlayer(player, true);
	}
});
