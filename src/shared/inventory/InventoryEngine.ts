import {
	InventoryGrantResult,
	InventoryItemDefinition,
	InventoryProfile,
	INVENTORY_PROFILE_SCHEMA_VERSION,
	MAX_CLAIMED_WORLD_PICKUPS,
	MAX_INVENTORY_ID_LENGTH,
	MAX_INVENTORY_ITEM_TYPES,
	MAX_WORLD_PICKUP_ID_LENGTH,
	WORLD_PICKUP_TRANSACTION_PREFIX,
	WorldPickupGrant,
} from "./InventoryTypes";

export function createEmptyInventoryProfile(): InventoryProfile {
	return { schemaVersion: INVENTORY_PROFILE_SCHEMA_VERSION, itemQuantities: {}, claimedWorldPickupIds: [] };
}

function definitionMap(
	definitions: ReadonlyArray<InventoryItemDefinition>,
): ReadonlyMap<string, InventoryItemDefinition> {
	const byId = new Map<string, InventoryItemDefinition>();
	for (const definition of definitions) byId.set(definition.id, definition);
	return byId;
}

function itemTypeCount(profile: InventoryProfile): number {
	let count = 0;
	for (const [_itemId] of pairs(profile.itemQuantities)) count += 1;
	return count;
}

export function claimWorldPickup(
	profile: InventoryProfile,
	definitions: ReadonlyArray<InventoryItemDefinition>,
	grant: WorldPickupGrant,
): InventoryGrantResult {
	if (
		grant.pickupId.size() === 0 ||
		grant.pickupId.size() > MAX_WORLD_PICKUP_ID_LENGTH ||
		grant.quantity < 1 ||
		math.floor(grant.quantity) !== grant.quantity
	) {
		return { ok: false, reason: "InvalidGrant" };
	}
	const definition = definitionMap(definitions).get(grant.itemId);
	if (definition === undefined) return { ok: false, reason: "UnknownItem" };
	if (profile.claimedWorldPickupIds.includes(grant.pickupId)) return { ok: false, reason: "AlreadyClaimed" };
	if (profile.claimedWorldPickupIds.size() >= MAX_CLAIMED_WORLD_PICKUPS) {
		return { ok: false, reason: "PickupHistoryFull" };
	}

	const currentQuantity = profile.itemQuantities[grant.itemId] ?? 0;
	if (currentQuantity === 0 && itemTypeCount(profile) >= MAX_INVENTORY_ITEM_TYPES) {
		return { ok: false, reason: "InventoryFull" };
	}
	if (currentQuantity + grant.quantity > definition.maxStack) {
		return { ok: false, reason: "InventoryFull" };
	}

	return {
		ok: true,
		profile: {
			...profile,
			itemQuantities: { ...profile.itemQuantities, [grant.itemId]: currentQuantity + grant.quantity },
			claimedWorldPickupIds: [...profile.claimedWorldPickupIds, grant.pickupId],
		},
		event: {
			kind: "ItemGranted",
			transactionId: `${WORLD_PICKUP_TRANSACTION_PREFIX}${grant.pickupId}`,
			itemId: grant.itemId,
			quantity: grant.quantity,
			source: "WorldPickup",
		},
	};
}
