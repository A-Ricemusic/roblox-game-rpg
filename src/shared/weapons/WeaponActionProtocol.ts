import { isLightComboStep, LightComboStep } from "./LightCombo";
import { asUnknownRecord, isFiniteNonNegativeNumber } from "../RuntimeTypeChecks";

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

export function parseWeaponActionRequest(value: unknown): WeaponActionRequest | undefined {
	const request = asUnknownRecord(value);
	if (request === undefined) return undefined;
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
