import { describe, expect, it } from "@rbxts/jest-globals";

import { INVENTORY_ITEM_DEFINITIONS } from "./InventoryDefinitions";
import { validateInventoryDefinitions } from "./InventoryDefinitionValidator";
import { InventoryItemDefinition } from "./InventoryTypes";

describe("InventoryDefinitionValidator", () => {
	it("accepts every shipped item and the configured starter weapon contract", () => {
		expect(validateInventoryDefinitions(INVENTORY_ITEM_DEFINITIONS)).toHaveLength(0);
		const sword = INVENTORY_ITEM_DEFINITIONS.find((item) => item.id === "hoplite_sword");
		expect(sword?.category).toBe("Weapon");
		expect(sword?.equipSlot).toBe("Weapon");
		expect(sword?.maxStack).toBe(1);
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

	it("requires the starter weapon registry contract", () => {
		const withoutStarter = INVENTORY_ITEM_DEFINITIONS.filter((item) => item.id !== "hoplite_sword");
		expect(
			validateInventoryDefinitions(withoutStarter).some(
				(issue) => issue.message.find("starter")[0] !== undefined,
			),
		).toBe(true);
		const malformedStarter: InventoryItemDefinition = {
			...INVENTORY_ITEM_DEFINITIONS[0],
			category: "Miscellaneous",
			equipSlot: undefined,
		};
		const malformedDefinitions = new Array<InventoryItemDefinition>();
		malformedDefinitions.push(malformedStarter);
		for (let index = 1; index < INVENTORY_ITEM_DEFINITIONS.size(); index++) {
			malformedDefinitions.push(INVENTORY_ITEM_DEFINITIONS[index]);
		}
		expect(
			validateInventoryDefinitions(malformedDefinitions).some((issue) => issue.path === "items.hoplite_sword"),
		).toBe(true);
	});
});
