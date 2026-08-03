import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import { InventoryHud } from "./InventoryHud";

let parent: Folder | undefined;
let hud: InventoryHud | undefined;

function descendant<T extends keyof Instances>(root: Instance, name: string, className: T): Instances[T] {
	const instance = root.FindFirstChild(name, true);
	assert(instance !== undefined && instance.IsA(className), `${name} must be a ${className}.`);
	return instance;
}

afterEach(() => {
	hud?.destroy();
	parent?.Destroy();
	hud = undefined;
	parent = undefined;
});

describe("InventoryHud", () => {
	it("respects Core UI safe areas and opens without overlapping the persistent toggle", () => {
		parent = new Instance("Folder");
		hud = new InventoryHud(parent);
		expect(hud.getRoot().ScreenInsets).toBe(Enum.ScreenInsets.CoreUISafeInsets);
		expect(hud.isOpen()).toBe(false);
		hud.setOpen(true);
		expect(hud.isOpen()).toBe(true);
		expect(hud.getToggleButton().Visible).toBe(false);
		expect(descendant(hud.getRoot(), "ResponsiveInventorySize", "UISizeConstraint").MaxSize.X).toBe(760);
	});

	it("renders empty and populated scrolling inventory states", () => {
		parent = new Instance("Folder");
		hud = new InventoryHud(parent);
		expect(descendant(hud.getRoot(), "InventoryEmpty", "TextLabel").Text).toContain("empty");
		hud.render({
			kind: "Snapshot",
			occupiedSlots: 1,
			maximumSlots: 200,
			items: [
				{
					itemId: "marble_fragment",
					displayName: "Marble Fragment",
					description: "Ancient stone.",
					category: "Material",
					quantity: 4,
				},
			],
		});
		expect(descendant(hud.getRoot(), "InventoryCapacity", "TextLabel").Text).toBe("1 / 200 SLOTS");
		expect(descendant(hud.getRoot(), "ItemName", "TextLabel").Text).toContain("×4");
		expect(descendant(hud.getRoot(), "InventoryContent", "ScrollingFrame").AutomaticCanvasSize).toBe(
			Enum.AutomaticSize.Y,
		);
	});
});
