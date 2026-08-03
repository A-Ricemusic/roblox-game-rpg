import { InventoryClientRequest, InventoryItemClientView, InventoryServerMessage } from "./InventoryTypes";

export const INVENTORY_REMOTES_FOLDER_NAME = "InventoryRemotes";
export const INVENTORY_REMOTE_EVENT_NAME = "InventoryRemote";

function isString(value: unknown): value is string {
	return typeIs(value, "string");
}

export function parseInventoryClientRequest(value: unknown): InventoryClientRequest | undefined {
	if (!typeIs(value, "table")) return undefined;
	return (value as Readonly<Record<string, unknown>>).kind === "RequestSnapshot"
		? { kind: "RequestSnapshot" }
		: undefined;
}

function parseItem(value: unknown): InventoryItemClientView | undefined {
	if (!typeIs(value, "table")) return undefined;
	const item = value as Readonly<Record<string, unknown>>;
	if (
		!isString(item.itemId) ||
		!isString(item.displayName) ||
		!isString(item.description) ||
		(item.category !== "Material" &&
			item.category !== "Consumable" &&
			item.category !== "Quest" &&
			item.category !== "Miscellaneous") ||
		!typeIs(item.quantity, "number") ||
		item.quantity < 1 ||
		math.floor(item.quantity) !== item.quantity ||
		(item.iconAssetId !== undefined && !isString(item.iconAssetId))
	) {
		return undefined;
	}
	return {
		itemId: item.itemId,
		displayName: item.displayName,
		description: item.description,
		category: item.category,
		quantity: item.quantity,
		iconAssetId: item.iconAssetId,
	};
}

export function parseInventoryServerMessage(value: unknown): InventoryServerMessage | undefined {
	if (!typeIs(value, "table")) return undefined;
	const message = value as Readonly<Record<string, unknown>>;
	if (
		message.kind !== "Snapshot" ||
		!typeIs(message.items, "table") ||
		!typeIs(message.occupiedSlots, "number") ||
		!typeIs(message.maximumSlots, "number")
	) {
		return undefined;
	}
	const items = new Array<InventoryItemClientView>();
	for (const value of message.items as ReadonlyArray<unknown>) {
		const item = parseItem(value);
		if (item === undefined) return undefined;
		items.push(item);
	}
	return {
		kind: "Snapshot",
		items,
		occupiedSlots: message.occupiedSlots,
		maximumSlots: message.maximumSlots,
	};
}
