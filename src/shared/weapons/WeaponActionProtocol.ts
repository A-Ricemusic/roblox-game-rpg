import { isLightComboStep, LightComboStep } from "./LightCombo";

export interface LightSwingRequest {
	readonly kind: "LightSwing";
	readonly actionId: number;
}

export type WeaponActionRequest = LightSwingRequest;

export interface LightSwingAccepted {
	readonly kind: "LightSwingAccepted";
	readonly actor: Player;
	readonly actionId: number;
	readonly startedAt: number;
	readonly comboStep: LightComboStep;
}

export const MAX_WEAPON_ACTION_ID = 2_147_483_647;

function isValidActionId(value: unknown): value is number {
	return typeIs(value, "number") && value >= 0 && value <= MAX_WEAPON_ACTION_ID && math.floor(value) === value;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
	return typeIs(value, "number") && value >= 0 && value < math.huge;
}

export function parseWeaponActionRequest(value: unknown): WeaponActionRequest | undefined {
	if (!typeIs(value, "table")) {
		return undefined;
	}

	const request = value as Readonly<Record<string, unknown>>;
	if (request.kind !== "LightSwing" || !isValidActionId(request.actionId)) {
		return undefined;
	}

	return { kind: "LightSwing", actionId: request.actionId };
}

export function parseLightSwingAccepted(
	kind: unknown,
	actor: unknown,
	actionId: unknown,
	startedAt: unknown,
	comboStep: unknown,
): LightSwingAccepted | undefined {
	if (
		kind !== "LightSwingAccepted" ||
		!typeIs(actor, "Instance") ||
		!actor.IsA("Player") ||
		!isValidActionId(actionId) ||
		!isFiniteNonNegativeNumber(startedAt) ||
		!isLightComboStep(comboStep)
	) {
		return undefined;
	}

	return { kind, actor, actionId, startedAt, comboStep };
}
