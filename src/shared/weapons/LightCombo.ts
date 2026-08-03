export type LightComboStep = 1 | 2 | 3 | 4;

export const LIGHT_COMBO_RESET_SECONDS = 1.1;
export const LIGHT_COMBO_MINIMUM_INTERVALS: Readonly<Record<LightComboStep, number>> = {
	1: 0.42,
	2: 0.42,
	3: 0.48,
	4: 0.72,
};

export interface LightComboState {
	readonly lastStep: LightComboStep;
	readonly lastAcceptedAt: number;
}

export interface LightComboAdvance {
	readonly step: LightComboStep;
	readonly state: LightComboState;
}

function stepAfter(step: LightComboStep): LightComboStep {
	return step === 4 ? 1 : ((step + 1) as LightComboStep);
}

export function advanceLightCombo(previous: LightComboState | undefined, now: number): LightComboAdvance {
	const step =
		previous === undefined || now - previous.lastAcceptedAt > LIGHT_COMBO_RESET_SECONDS
			? 1
			: stepAfter(previous.lastStep);
	return { step, state: { lastStep: step, lastAcceptedAt: now } };
}

export function isLightComboStep(value: unknown): value is LightComboStep {
	return value === 1 || value === 2 || value === 3 || value === 4;
}
