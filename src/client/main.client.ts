import { Players } from "@rbxts/services";

import { QuestClientController } from "./quests/QuestClientController";
import { QuestHud } from "./quests/QuestHud";
import { InventoryClientController } from "./inventory/InventoryClientController";
import { InventoryHud } from "./inventory/InventoryHud";
import { WeaponClientController } from "./weapons/WeaponClientController";
import { PlayerResourceController } from "./resources/PlayerResourceController";
import { PlayerResourceHud } from "./resources/PlayerResourceHud";

const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
const questHud = new QuestHud(playerGui);
const questController = new QuestClientController(questHud);
questController.start();

const inventoryHud = new InventoryHud(playerGui);
const inventoryController = new InventoryClientController(inventoryHud, undefined, undefined, () =>
	questHud.setJournalOpen(false),
);
inventoryController.start();
questHud.setBeforeJournalOpen(() => inventoryController.toggle(false));

const resourceHud = new PlayerResourceHud(playerGui);
const resourceController = new PlayerResourceController(resourceHud);
resourceController.start();

const weaponController = new WeaponClientController(() => !inventoryHud.isOpen() && !questHud.isJournalOpen());
weaponController.start();
