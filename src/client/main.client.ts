import { Players } from "@rbxts/services";

import { QuestClientController } from "./quests/QuestClientController";
import { QuestHud } from "./quests/QuestHud";
import { InventoryClientController } from "./inventory/InventoryClientController";
import { InventoryHud } from "./inventory/InventoryHud";
import { WeaponClientController } from "./weapons/WeaponClientController";
import { AnimationLabController } from "./animation-lab/AnimationLabController";

const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
const hud = new QuestHud(playerGui);
const questController = new QuestClientController(hud);
questController.start();

const inventoryHud = new InventoryHud(playerGui);
const inventoryController = new InventoryClientController(inventoryHud);
inventoryController.start();

const weaponController = new WeaponClientController(() => !inventoryHud.isOpen());
weaponController.start();

const animationLab = new AnimationLabController();
animationLab.start();
