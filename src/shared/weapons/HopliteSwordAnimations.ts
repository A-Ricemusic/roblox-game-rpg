import { LightComboStep } from "./LightCombo";

export interface HopliteSwordAnimationDefinition {
	readonly name: string;
	readonly animationId: `rbxassetid://${number}`;
	readonly sourceDurationSeconds: number;
	readonly durationSeconds: number;
	readonly playbackSpeed: number;
}

export const HOPLITE_SWORD_ATTACK_ANIMATIONS: Readonly<Record<LightComboStep, HopliteSwordAnimationDefinition>> = {
	1: {
		name: "SwordAttack01_DownwardDiagonal",
		animationId: "rbxassetid://83182657464711",
		sourceDurationSeconds: 10 / 24,
		durationSeconds: 0.42,
		playbackSpeed: 10 / 24 / 0.42,
	},
	2: {
		name: "SwordAttack02_RisingDiagonal",
		animationId: "rbxassetid://70892634115680",
		sourceDurationSeconds: 10 / 24,
		durationSeconds: 0.42,
		playbackSpeed: 10 / 24 / 0.42,
	},
	3: {
		name: "SwordAttack03_ForwardThrust",
		animationId: "rbxassetid://126076962540032",
		sourceDurationSeconds: 11 / 24,
		durationSeconds: 0.48,
		playbackSpeed: 11 / 24 / 0.48,
	},
	4: {
		name: "SwordAttack04_Whirlwind",
		animationId: "rbxassetid://135731593516669",
		sourceDurationSeconds: 17 / 24,
		durationSeconds: 0.72,
		playbackSpeed: 17 / 24 / 0.72,
	},
};
