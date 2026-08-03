import {
	InventoryItemClientView,
	InventoryItemDefinition,
	InventoryProfile,
	InventoryServerMessage,
	MAX_INVENTORY_ITEM_TYPES,
} from "./InventoryTypes";

export function buildInventorySnapshot(
	profile: InventoryProfile,
	definitions: ReadonlyArray<InventoryItemDefinition>,
): InventoryServerMessage {
	const definitionsById = new Map<string, InventoryItemDefinition>();
	for (const definition of definitions) definitionsById.set(definition.id, definition);
	const items = new Array<InventoryItemClientView>();
	for (const [itemId, quantity] of pairs(profile.itemQuantities)) {
		const definition = definitionsById.get(itemId);
		if (definition === undefined || quantity < 1) continue;
		items.push({
			itemId,
			displayName: definition.displayName,
			description: definition.description,
			category: definition.category,
			quantity,
			iconAssetId: definition.iconAssetId,
		});
	}
	items.sort((left, right) => left.displayName < right.displayName);
	return { kind: "Snapshot", items, occupiedSlots: items.size(), maximumSlots: MAX_INVENTORY_ITEM_TYPES };
}
