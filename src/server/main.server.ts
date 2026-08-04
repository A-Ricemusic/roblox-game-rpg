import { CollectionService, Players, ProximityPromptService } from "@rbxts/services";

import { QUEST_DEFINITIONS } from "shared/quests/QuestDefinitions";
import { assertValidQuestDefinitions } from "shared/quests/QuestDefinitionValidator";
import { INVENTORY_ITEM_DEFINITIONS } from "shared/inventory/InventoryDefinitions";
import { assertValidInventoryDefinitions } from "shared/inventory/InventoryDefinitionValidator";

import { CollectibleRegistry, RobloxCollectionTagSource } from "./collectibles/CollectibleRegistry";
import { CollectiblePromptRouter } from "./collectibles/CollectiblePromptRouter";
import { QuestCollectibleClaimService } from "./collectibles/QuestCollectibleClaimService";
import { createPlayerDatabaseRepository } from "./config/PlayerDatabaseConfig";
import { InventoryProfileService } from "./inventory/InventoryProfileService";
import { InventoryEquipmentCoordinator } from "./inventory/InventoryEquipmentCoordinator";
import { InventoryPickupCoordinator } from "./inventory/InventoryPickupCoordinator";
import { InventoryQuestBridge } from "./inventory/InventoryQuestBridge";
import { getOrCreateInventoryRemote, InventoryRemoteService } from "./inventory/InventoryRemoteService";
import { WorldPickupClaimService } from "./inventory/WorldPickupClaimService";
import { RobloxInventoryPickupTagSource, WorldPickupRegistry } from "./inventory/WorldPickupRegistry";
import { PlayerProfileService } from "./player/PlayerProfileService";
import { ResilientPlayerProfileStore } from "./player/persistence/ResilientPlayerProfileStore";
import { QuestProfileService } from "./quests/QuestProfileService";
import { getOrCreateQuestRemote, QuestRemoteService } from "./quests/QuestRemoteService";
import { WeaponRuntime } from "./weapons/WeaponRuntime";
import { BanditEnemySystem } from "./enemies/BanditEnemySystem";
import { BANDIT_TAG } from "./enemies/BanditConstants";
import { createBandit } from "./enemies/BanditFactory";

const AUTOSAVE_INTERVAL_SECONDS = 60;
const SHUTDOWN_LOAD_DRAIN_SECONDS = 10;

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
const weapons = new WeaponRuntime((player) => inventories.get(profileKey(player))?.equipment.weapon);
const equipment = new InventoryEquipmentCoordinator(inventories, weapons);
const inventoryQuestBridge = new InventoryQuestBridge(profiles);
const registry = new CollectibleRegistry(new RobloxCollectionTagSource());
const claims = new QuestCollectibleClaimService(registry, profiles);
const remotes = new QuestRemoteService(getOrCreateQuestRemote(), profiles, QUEST_DEFINITIONS);
const inventoryItemIds = new Set<string>();
for (const definition of INVENTORY_ITEM_DEFINITIONS) inventoryItemIds.add(definition.id);
const pickupRegistry = new WorldPickupRegistry(new RobloxInventoryPickupTagSource(), (itemId) =>
	inventoryItemIds.has(itemId),
);
const pickupClaims = new WorldPickupClaimService(pickupRegistry, inventories);
const pickupCoordinator = new InventoryPickupCoordinator(pickupClaims, inventoryQuestBridge);
const inventoryRemotes = new InventoryRemoteService(
	getOrCreateInventoryRemote(),
	inventories,
	INVENTORY_ITEM_DEFINITIONS,
	equipment,
	os.clock,
);
const collectiblePromptRouter = new CollectiblePromptRouter(
	pickupRegistry,
	pickupCoordinator,
	inventoryRemotes,
	remotes,
	registry,
	claims,
);
const loadingProfileKeys = new Set<string>();
const bandits = new BanditEnemySystem();
let closing = false;

registry.start();
pickupRegistry.start();
const remoteConnection = remotes.start(profileKey);
const inventoryRemoteConnection = inventoryRemotes.start(profileKey);
weapons.start();
bandits.start();
if (game.Workspace.GetAttribute("DisableDemoBandit") !== true && CollectionService.GetTagged(BANDIT_TAG).size() === 0) {
	const demoBandit = createBandit(new CFrame(0, 5, 24));
	demoBandit.Parent = game.Workspace;
}

function loadPlayer(player: Player): void {
	const key = profileKey(player);
	if (playerProfiles.getQuarantineReason(key) !== undefined) {
		player.Kick("Your player data session lost database ownership. Please reconnect.");
		return;
	}
	if (playerProfiles.isClosing(key)) {
		const release = playerProfiles.unload(key);
		if (!release.ok) {
			player.Kick("Your previous player session is still closing. Please reconnect.");
			return;
		}
	}
	if (playerProfiles.get(key) !== undefined) {
		if (player.Parent === Players) {
			equipment.syncPlayer(player);
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
	equipment.syncPlayer(currentPlayer);
	remotes.sendSnapshot(currentPlayer, key);
	inventoryRemotes.sendSnapshot(currentPlayer, key);
}

function savePlayer(player: Player, unload: boolean): void {
	const key = profileKey(player);
	if (playerProfiles.get(key) === undefined) return;
	const result = unload ? playerProfiles.unload(key) : playerProfiles.save(key);
	if (!result.ok) {
		warn(`[PlayerRuntime] Failed to save ${key}: ${result.error}`);
		if (result.kind === "OwnershipLost") {
			player.Kick("Your player data session lost database ownership. Please reconnect.");
		}
	}
}

const playerAddedConnection = Players.PlayerAdded.Connect(loadPlayer);
const playerRemovingConnection = Players.PlayerRemoving.Connect((player) => {
	remotes.forget(profileKey(player));
	inventoryRemotes.forget(profileKey(player));
	savePlayer(player, true);
});
for (const player of Players.GetPlayers()) task.spawn(() => loadPlayer(player));

const promptConnection = ProximityPromptService.PromptTriggered.Connect((prompt, player) => {
	collectiblePromptRouter.handle(prompt, player, player.Character, profileKey(player));
});

task.spawn(() => {
	while (!closing) {
		task.wait(AUTOSAVE_INTERVAL_SECONDS);
		if (!closing) {
			for (const player of Players.GetPlayers()) savePlayer(player, false);
			for (const key of playerProfiles.getLoadedProfileKeys()) {
				if (!playerProfiles.isClosing(key)) continue;
				const result = playerProfiles.unload(key);
				if (!result.ok) warn(`[PlayerRuntime] Failed to retry release ${key}: ${result.error}`);
			}
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
	bandits.stop();
	const loadDrainDeadline = os.clock() + SHUTDOWN_LOAD_DRAIN_SECONDS;
	while (loadingProfileKeys.size() > 0 && os.clock() < loadDrainDeadline) task.wait(0.05);
	if (loadingProfileKeys.size() > 0) {
		warn(`[PlayerRuntime] Shutdown timed out waiting for ${loadingProfileKeys.size()} profile load(s).`);
	}
	for (const key of playerProfiles.getLoadedProfileKeys()) {
		const result = playerProfiles.unload(key);
		if (!result.ok) warn(`[PlayerRuntime] Failed to release ${key} during shutdown: ${result.error}`);
	}
});
