import {
	InventoryItemDefinition,
	InventoryProfile,
	INVENTORY_PROFILE_SCHEMA_VERSION,
	MAX_CLAIMED_WORLD_PICKUPS,
	MAX_INVENTORY_ID_LENGTH,
	MAX_INVENTORY_ITEM_TYPES,
	MAX_WORLD_PICKUP_ID_LENGTH,
} from "./InventoryTypes";
import { createEmptyInventoryProfile } from "./InventoryEngine";

export type InventoryProfileDecodeResult =
	{ readonly ok: true; readonly profile: InventoryProfile } | { readonly ok: false; readonly error: string };

function validId(value: unknown): value is string {
	return typeIs(value, "string") && value.size() > 0 && value.size() <= MAX_INVENTORY_ID_LENGTH;
}

function validPickupId(value: unknown): value is string {
	return typeIs(value, "string") && value.size() > 0 && value.size() <= MAX_WORLD_PICKUP_ID_LENGTH;
}

function readPickupIds(value: unknown): string[] | undefined {
	if (!typeIs(value, "table")) return undefined;
	const array = value as ReadonlyArray<unknown>;
	const length = array.size();
	if (length > MAX_CLAIMED_WORLD_PICKUPS) return undefined;
	let entryCount = 0;
	for (const [key] of pairs(value as Readonly<Record<number, unknown>>)) {
		if (!typeIs(key, "number") || key < 1 || key > length || math.floor(key) !== key) return undefined;
		entryCount += 1;
	}
	if (entryCount !== length) return undefined;

	const output = new Array<string>();
	const seen = new Set<string>();
	for (const pickupId of array) {
		if (!validPickupId(pickupId) || seen.has(pickupId)) return undefined;
		output.push(pickupId);
		seen.add(pickupId);
	}
	return output;
}

export function decodeInventoryProfile(
	value: unknown,
	definitions: ReadonlyArray<InventoryItemDefinition>,
): InventoryProfileDecodeResult {
	if (value === undefined) return { ok: true, profile: createEmptyInventoryProfile() };
	if (!typeIs(value, "table")) return { ok: false, error: "Inventory profile must be a table." };
	const record = value as Readonly<Record<string, unknown>>;
	if (record.schemaVersion !== INVENTORY_PROFILE_SCHEMA_VERSION) {
		return { ok: false, error: `Unsupported inventory profile schema version '${record.schemaVersion}'.` };
	}
	if (!typeIs(record.itemQuantities, "table") || !typeIs(record.claimedWorldPickupIds, "table")) {
		return { ok: false, error: "Inventory profile contains invalid item or pickup data." };
	}

	const definitionsById = new Map<string, InventoryItemDefinition>();
	for (const definition of definitions) definitionsById.set(definition.id, definition);
	const itemQuantities: Record<string, number> = {};
	let itemTypes = 0;
	for (const [itemId, quantity] of pairs(record.itemQuantities as Readonly<Record<string, unknown>>)) {
		const definition = definitionsById.get(itemId);
		if (
			!validId(itemId) ||
			definition === undefined ||
			!typeIs(quantity, "number") ||
			quantity < 1 ||
			math.floor(quantity) !== quantity ||
			quantity > definition.maxStack
		) {
			return { ok: false, error: `Inventory item '${itemId}' has invalid persisted data.` };
		}
		itemTypes += 1;
		if (itemTypes > MAX_INVENTORY_ITEM_TYPES) {
			return { ok: false, error: "Inventory profile contains too many item types." };
		}
		itemQuantities[itemId] = quantity;
	}

	const pickupIds = readPickupIds(record.claimedWorldPickupIds);
	if (pickupIds === undefined) {
		return { ok: false, error: "Inventory profile contains an invalid, sparse, or duplicate pickup ID list." };
	}

	return {
		ok: true,
		profile: { schemaVersion: INVENTORY_PROFILE_SCHEMA_VERSION, itemQuantities, claimedWorldPickupIds: pickupIds },
	};
}
