import { Players } from "@rbxts/services";

import { QuestClientController } from "./quests/QuestClientController";
import { QuestHud } from "./quests/QuestHud";
import { WeaponClientController } from "./weapons/WeaponClientController";

const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
const hud = new QuestHud(playerGui);
const questController = new QuestClientController(hud);
questController.start();

const weaponController = new WeaponClientController();
weaponController.start();
