export type UnknownRecord = Readonly<Record<string, unknown>>;

export function asUnknownRecord(value: unknown): UnknownRecord | undefined {
	return typeIs(value, "table") ? (value as UnknownRecord) : undefined;
}

export function isFiniteNonNegativeNumber(value: unknown): value is number {
	return typeIs(value, "number") && value >= 0 && value < math.huge;
}

export function isNonNegativeInteger(value: unknown): value is number {
	return isFiniteNonNegativeNumber(value) && math.floor(value) === value;
}
