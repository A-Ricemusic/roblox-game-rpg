import { InventoryItemDefinition } from "./InventoryTypes";
import { HOPLITE_SWORD_ITEM_ID } from "shared/items/ItemIds";

export const INVENTORY_ITEM_DEFINITIONS = [
	{
		id: HOPLITE_SWORD_ITEM_ID,
		displayName: "Hoplite Sword",
		description: "A dependable bronze blade carried by a warrior of the polis.",
		category: "Weapon",
		maxStack: 1,
		canDrop: false,
		equipSlot: "Weapon",
	},
	{
		id: "sacred_olive_branch",
		displayName: "Sacred Olive Branch",
		description: "A fragrant branch suitable for an offering to the gods.",
		category: "Quest",
		maxStack: 99,
		canDrop: false,
	},
	{
		id: "marble_fragment",
		displayName: "Marble Fragment",
		description: "A weathered fragment from an ancient Greek monument.",
		category: "Material",
		maxStack: 999,
		canDrop: true,
	},
	{
		id: "ambrosia_vial",
		displayName: "Vial of Ambrosia",
		description: "A sealed vial containing a trace of divine nourishment.",
		category: "Consumable",
		maxStack: 20,
		canDrop: false,
	},
] as const satisfies ReadonlyArray<InventoryItemDefinition>;
