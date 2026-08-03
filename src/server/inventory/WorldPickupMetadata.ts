import { MAX_INVENTORY_ID_LENGTH, MAX_WORLD_PICKUP_ID_LENGTH } from "shared/inventory/InventoryTypes";

export const INVENTORY_PICKUP_TAG = "InventoryPickup";

export const INVENTORY_PICKUP_ATTRIBUTES = {
	pickupId: "InventoryPickupId",
	itemId: "InventoryItemId",
	quantity: "InventoryItemQuantity",
} as const;

export interface WorldPickupMetadata {
	readonly pickupId: string;
	readonly itemId: string;
	readonly quantity: number;
}

export type WorldPickupValidationResult =
	{ readonly ok: true; readonly metadata: WorldPickupMetadata } | { readonly ok: false; readonly error: string };

const MAX_PICKUP_QUANTITY = 1_000;

function readId(instance: Instance, attribute: string, maximumLength: number): string | undefined {
	const value = instance.GetAttribute(attribute);
	return typeIs(value, "string") && value.size() > 0 && value.size() <= maximumLength ? value : undefined;
}

export function getWorldPickupPosition(instance: Instance): Vector3 | undefined {
	if (instance.IsA("BasePart")) return instance.Position;
	if (instance.IsA("Attachment")) return instance.WorldPosition;
	if (instance.IsA("Model") && instance.PrimaryPart !== undefined) return instance.PrimaryPart.Position;
	return undefined;
}

export function validateWorldPickupMetadata(instance: Instance): WorldPickupValidationResult {
	if (getWorldPickupPosition(instance) === undefined) {
		return { ok: false, error: "Tagged pickup must be a BasePart, Attachment, or Model with a PrimaryPart." };
	}
	const pickupId = readId(instance, INVENTORY_PICKUP_ATTRIBUTES.pickupId, MAX_WORLD_PICKUP_ID_LENGTH);
	if (pickupId === undefined) {
		return { ok: false, error: `Missing or invalid '${INVENTORY_PICKUP_ATTRIBUTES.pickupId}' attribute.` };
	}
	const itemId = readId(instance, INVENTORY_PICKUP_ATTRIBUTES.itemId, MAX_INVENTORY_ID_LENGTH);
	if (itemId === undefined) {
		return { ok: false, error: `Missing or invalid '${INVENTORY_PICKUP_ATTRIBUTES.itemId}' attribute.` };
	}
	const quantity = instance.GetAttribute(INVENTORY_PICKUP_ATTRIBUTES.quantity) ?? 1;
	if (
		!typeIs(quantity, "number") ||
		quantity < 1 ||
		math.floor(quantity) !== quantity ||
		quantity > MAX_PICKUP_QUANTITY
	) {
		return {
			ok: false,
			error: `'${INVENTORY_PICKUP_ATTRIBUTES.quantity}' must be an integer from 1 to ${MAX_PICKUP_QUANTITY}.`,
		};
	}
	return { ok: true, metadata: { pickupId, itemId, quantity } };
}

export function isCharacterWithinPickupDistance(
	character: Model | undefined,
	pickup: Instance,
	maximumDistance: number,
): boolean {
	if (character === undefined || maximumDistance < 0 || maximumDistance >= math.huge) return false;
	const root = character.FindFirstChild("HumanoidRootPart");
	const position = getWorldPickupPosition(pickup);
	return root !== undefined && root.IsA("BasePart") && position !== undefined
		? root.Position.sub(position).Magnitude <= maximumDistance
		: false;
}
