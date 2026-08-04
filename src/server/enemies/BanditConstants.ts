export const BANDIT_TAG = "bandit";

export const BANDIT_ANIMATION_IDS = {
	idle: "rbxassetid://72885592572346",
	run: "rbxassetid://90657540114064",
	attack: "rbxassetid://72279573649472",
} as const;

export const BANDIT_DEFAULTS = {
	detectionRadius: 70,
	attackRange: 5.5,
	damage: 18,
	attackCooldown: 1.25,
	walkSpeed: 14,
} as const;

export interface BanditTuning {
	detectionRadius: number;
	attackRange: number;
	damage: number;
	attackCooldown: number;
	walkSpeed: number;
}

function positiveAttribute(model: Model, name: string, fallback: number): number {
	const value = model.GetAttribute(name);
	return typeIs(value, "number") && value > 0 ? value : fallback;
}

export function readBanditTuning(model: Model): BanditTuning {
	return {
		detectionRadius: positiveAttribute(model, "DetectionRadius", BANDIT_DEFAULTS.detectionRadius),
		attackRange: positiveAttribute(model, "AttackRange", BANDIT_DEFAULTS.attackRange),
		damage: positiveAttribute(model, "Damage", BANDIT_DEFAULTS.damage),
		attackCooldown: positiveAttribute(model, "AttackCooldown", BANDIT_DEFAULTS.attackCooldown),
		walkSpeed: positiveAttribute(model, "WalkSpeed", BANDIT_DEFAULTS.walkSpeed),
	};
}
