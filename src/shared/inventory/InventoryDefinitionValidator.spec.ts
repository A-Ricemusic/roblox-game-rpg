import { describe, expect, it } from "@rbxts/jest-globals";

import { INVENTORY_ITEM_DEFINITIONS } from "./InventoryDefinitions";
import { validateInventoryDefinitions } from "./InventoryDefinitionValidator";
import { InventoryItemDefinition } from "./InventoryTypes";

describe("InventoryDefinitionValidator", () => {
	it("accepts every shipped non-weapon item", () => {
		expect(validateInventoryDefinitions(INVENTORY_ITEM_DEFINITIONS)).toHaveLength(0);
		expect(INVENTORY_ITEM_DEFINITIONS.some((item) => item.id.find("sword")[0] !== undefined)).toBe(false);
	});

	it("rejects duplicate IDs and unusable presentation or stack data", () => {
		const invalid = {
			id: "duplicate",
			displayName: "",
			description: "",
			category: "Miscellaneous",
			maxStack: 0,
			canDrop: true,
		} as const satisfies InventoryItemDefinition;
		const issues = validateInventoryDefinitions([invalid, { ...invalid, displayName: "Again" }]);
		expect(issues.some((issue) => issue.message.find("Duplicate")[0] !== undefined)).toBe(true);
		expect(issues.some((issue) => issue.path === "items[0].maxStack")).toBe(true);
		const nonFinite = validateInventoryDefinitions([{ ...invalid, id: "infinite", maxStack: math.huge }]);
		expect(nonFinite.some((issue) => issue.path === "items[0].maxStack")).toBe(true);
	});
});
