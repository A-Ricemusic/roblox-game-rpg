import { InventoryItemDefinition, MAX_INVENTORY_ID_LENGTH, MAX_INVENTORY_STACK_QUANTITY } from "./InventoryTypes";

export interface InventoryDefinitionIssue {
	readonly path: string;
	readonly message: string;
}

export function validateInventoryDefinitions(
	definitions: ReadonlyArray<InventoryItemDefinition>,
): InventoryDefinitionIssue[] {
	const issues = new Array<InventoryDefinitionIssue>();
	const ids = new Set<string>();
	for (let index = 0; index < definitions.size(); index++) {
		const definition = definitions[index];
		const path = `items[${index}]`;
		if (definition.id.size() === 0 || definition.id.size() > MAX_INVENTORY_ID_LENGTH) {
			issues.push({ path: `${path}.id`, message: `ID must contain 1-${MAX_INVENTORY_ID_LENGTH} characters.` });
		}
		if (ids.has(definition.id)) {
			issues.push({ path: `${path}.id`, message: `Duplicate item ID '${definition.id}'.` });
		}
		ids.add(definition.id);
		if (definition.displayName.size() === 0) {
			issues.push({ path: `${path}.displayName`, message: "Display name must not be empty." });
		}
		if (definition.description.size() === 0) {
			issues.push({ path: `${path}.description`, message: "Description must not be empty." });
		}
		if (
			definition.maxStack < 1 ||
			definition.maxStack > MAX_INVENTORY_STACK_QUANTITY ||
			math.floor(definition.maxStack) !== definition.maxStack
		) {
			issues.push({
				path: `${path}.maxStack`,
				message: `Maximum stack must be an integer from 1 through ${MAX_INVENTORY_STACK_QUANTITY}.`,
			});
		}
		if (definition.iconAssetId !== undefined && definition.iconAssetId.size() === 0) {
			issues.push({ path: `${path}.iconAssetId`, message: "Icon asset ID must not be empty when provided." });
		}
	}
	return issues;
}

export function assertValidInventoryDefinitions(definitions: ReadonlyArray<InventoryItemDefinition>): void {
	const issues = validateInventoryDefinitions(definitions);
	if (issues.size() > 0) {
		error(`Invalid inventory definitions:\n${issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")}`);
	}
}
