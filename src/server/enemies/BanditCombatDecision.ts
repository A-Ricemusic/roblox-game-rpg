export type BanditCombatDecision = "Advance" | "Retreat" | "Attack";

export function getBanditCombatDecision(
	distance: number,
	ranged: boolean,
	attackRange: number,
	preferredRange: number,
): BanditCombatDecision {
	if (distance > attackRange) return "Advance";
	if (ranged && distance < preferredRange * 0.55) return "Retreat";
	return "Attack";
}
