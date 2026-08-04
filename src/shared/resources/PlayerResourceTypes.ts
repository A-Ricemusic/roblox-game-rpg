export type PlayerResourceKind = "Health" | "Stamina" | "Magic";

export interface PlayerResourceValue {
	readonly current: number;
	readonly maximum: number;
}

export interface PlayerResourceSnapshot {
	readonly health: PlayerResourceValue;
	readonly stamina: PlayerResourceValue;
	readonly magic: PlayerResourceValue;
}

function finite(value: number): boolean {
	return value === value && math.abs(value) < math.huge;
}

export function normalizePlayerResource(current: number, maximum: number): PlayerResourceValue {
	const safeMaximum = finite(maximum) && maximum > 0 ? maximum : 0;
	const safeCurrent = finite(current) ? math.clamp(current, 0, safeMaximum) : 0;
	return { current: safeCurrent, maximum: safeMaximum };
}

export function createInitialPlayerResourceSnapshot(): PlayerResourceSnapshot {
	return {
		health: { current: 0, maximum: 100 },
		stamina: { current: 100, maximum: 100 },
		magic: { current: 100, maximum: 100 },
	};
}
