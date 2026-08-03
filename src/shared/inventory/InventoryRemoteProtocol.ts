import {
	InventoryClientRequest,
	InventoryItemClientView,
	InventoryServerMessage,
	MAX_INVENTORY_ID_LENGTH,
	MAX_INVENTORY_ITEM_TYPES,
	MAX_INVENTORY_STACK_QUANTITY,
} from "./InventoryTypes";

export const INVENTORY_REMOTES_FOLDER_NAME = "InventoryRemotes";
export const INVENTORY_REMOTE_EVENT_NAME = "InventoryRemote";

function isString(value: unknown): value is string {
	return typeIs(value, "string");
}

export function parseInventoryClientRequest(value: unknown): InventoryClientRequest | undefined {
	if (!typeIs(value, "table")) return undefined;
	const request = value as Readonly<Record<string, unknown>>;
	if (request.kind === "RequestSnapshot") {
		for (const [key] of pairs(request)) if (key !== "kind") return undefined;
		return { kind: "RequestSnapshot" };
	}
	if (request.kind !== "SetWeaponEquipped") return undefined;
	for (const [key] of pairs(request)) if (key !== "kind" && key !== "itemId") return undefined;
	if (
		request.itemId !== undefined &&
		(!isString(request.itemId) || request.itemId.size() === 0 || request.itemId.size() > MAX_INVENTORY_ID_LENGTH)
	) {
		return undefined;
	}
	return { kind: "SetWeaponEquipped", itemId: request.itemId };
}

function parseItem(value: unknown): InventoryItemClientView | undefined {
	if (!typeIs(value, "table")) return undefined;
	const item = value as Readonly<Record<string, unknown>>;
	if (
		!isString(item.itemId) ||
		item.itemId.size() === 0 ||
		item.itemId.size() > MAX_INVENTORY_ID_LENGTH ||
		!isString(item.displayName) ||
		!isString(item.description) ||
		(item.category !== "Material" &&
			item.category !== "Consumable" &&
			item.category !== "Quest" &&
			item.category !== "Weapon" &&
			item.category !== "Miscellaneous") ||
		!typeIs(item.quantity, "number") ||
		item.quantity < 1 ||
		item.quantity > MAX_INVENTORY_STACK_QUANTITY ||
		math.floor(item.quantity) !== item.quantity ||
		(item.iconAssetId !== undefined && !isString(item.iconAssetId)) ||
		(item.equipSlot !== undefined && item.equipSlot !== "Weapon") ||
		!typeIs(item.equipped, "boolean") ||
		(item.equipped && item.equipSlot !== "Weapon")
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
		equipSlot: item.equipSlot,
		equipped: item.equipped,
	};
}

export function parseInventoryServerMessage(value: unknown): InventoryServerMessage | undefined {
	if (!typeIs(value, "table")) return undefined;
	const message = value as Readonly<Record<string, unknown>>;
	if (
		message.kind !== "Snapshot" ||
		!typeIs(message.items, "table") ||
		!typeIs(message.occupiedSlots, "number") ||
		!typeIs(message.maximumSlots, "number") ||
		message.occupiedSlots < 0 ||
		math.floor(message.occupiedSlots) !== message.occupiedSlots ||
		message.maximumSlots < 0 ||
		message.maximumSlots > MAX_INVENTORY_ITEM_TYPES ||
		math.floor(message.maximumSlots) !== message.maximumSlots
	) {
		return undefined;
	}
	const rawItems = message.items as ReadonlyArray<unknown>;
	const itemCount = rawItems.size();
	let tableEntryCount = 0;
	for (const [key] of pairs(message.items as Readonly<Record<number, unknown>>)) {
		if (!typeIs(key, "number") || key < 1 || key > itemCount || math.floor(key) !== key) return undefined;
		tableEntryCount += 1;
	}
	if (tableEntryCount !== itemCount) return undefined;
	const items = new Array<InventoryItemClientView>();
	for (const value of rawItems) {
		if (items.size() >= MAX_INVENTORY_ITEM_TYPES) return undefined;
		const item = parseItem(value);
		if (item === undefined) return undefined;
		items.push(item);
	}
	if (message.occupiedSlots !== items.size() || message.occupiedSlots > message.maximumSlots) return undefined;
	return {
		kind: "Snapshot",
		items,
		occupiedSlots: message.occupiedSlots,
		maximumSlots: message.maximumSlots,
	};
}
