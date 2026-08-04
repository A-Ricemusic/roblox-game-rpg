import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import { PlayerResourceHud } from "./PlayerResourceHud";

let parent: Folder | undefined;
let hud: PlayerResourceHud | undefined;

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

describe("PlayerResourceHud", () => {
	it("uses safe insets and responsive desktop placement", () => {
		parent = new Instance("Folder");
		hud = new PlayerResourceHud(parent, false);
		const root = hud.getRoot();
		const stack = descendant(root, "ResourceStack", "Frame");
		expect(root.ScreenInsets).toBe(Enum.ScreenInsets.CoreUISafeInsets);
		expect(stack.AnchorPoint).toEqual(new Vector2(0, 1));
		expect(stack.Position).toEqual(new UDim2(0, 18, 1, -24));
		expect(descendant(root, "ResponsiveResourceSize", "UISizeConstraint").MaxSize.X).toBe(340);
	});

	it("raises and centers the resource stack for touch controls", () => {
		parent = new Instance("Folder");
		hud = new PlayerResourceHud(parent, true);
		const stack = descendant(hud.getRoot(), "ResourceStack", "Frame");
		expect(stack.AnchorPoint).toEqual(new Vector2(0.5, 1));
		expect(stack.Position).toEqual(new UDim2(0.5, 0, 1, -126));
	});

	it("renders all three resource values and fill ratios in place", () => {
		parent = new Instance("Folder");
		hud = new PlayerResourceHud(parent, false);
		const healthFill = descendant(hud.getRoot(), "HealthFill", "Frame");
		hud.render({
			health: { current: 75, maximum: 100 },
			stamina: { current: 50, maximum: 100 },
			magic: { current: 25, maximum: 50 },
		});
		expect(healthFill.Size.X.Scale).toBe(0.75);
		expect(descendant(hud.getRoot(), "StaminaFill", "Frame").Size.X.Scale).toBe(0.5);
		expect(descendant(hud.getRoot(), "MagicValue", "TextLabel").Text).toBe("25 / 50");
		hud.render({
			health: { current: 20, maximum: 100 },
			stamina: { current: 100, maximum: 100 },
			magic: { current: 100, maximum: 100 },
		});
		expect(descendant(hud.getRoot(), "HealthFill", "Frame")).toBe(healthFill);
		expect(healthFill.Size.X.Scale).toBe(0.2);
	});
});
