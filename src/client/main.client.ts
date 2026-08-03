import { Players } from "@rbxts/services";

import { QuestClientController } from "./quests/QuestClientController";
import { QuestHud } from "./quests/QuestHud";
import { WeaponClientController } from "./weapons/WeaponClientController";
import { AnimationLabController } from "./animation-lab/AnimationLabController";

const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
const hud = new QuestHud(playerGui);
const questController = new QuestClientController(hud);
questController.start();

const weaponController = new WeaponClientController();
weaponController.start();

const animationLab = new AnimationLabController();
animationLab.start();
