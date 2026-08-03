import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import { QuestClientView } from "shared/quests/QuestTypes";

import { QuestHud } from "./QuestHud";

let parent: Folder | undefined;
let hud: QuestHud | undefined;

afterEach(() => {
	hud?.destroy();
	parent?.Destroy();
	hud = undefined;
	parent = undefined;
});

function findDescendant<T extends keyof Instances>(root: Instance, name: string, className: T): Instances[T] {
	const instance = root.FindFirstChild(name, true);
	assert(instance !== undefined && instance.IsA(className), `${name} must be a ${className}.`);
	return instance;
}

describe("QuestHud", () => {
	it("respects Roblox Core UI and scales across viewport sizes", () => {
		parent = new Instance("Folder");
		hud = new QuestHud(parent);

		const root = hud.getRoot();
		const panel = findDescendant(root, "QuestPanel", "Frame");
		const responsiveWidth = findDescendant(panel, "ResponsiveWidth", "UISizeConstraint");

		expect(root.ScreenInsets).toBe(Enum.ScreenInsets.CoreUISafeInsets);
		expect(root.ClipToDeviceSafeArea).toBe(true);
		expect(panel.AnchorPoint).toEqual(new Vector2(1, 0));
		expect(panel.Position).toEqual(new UDim2(1, -16, 0, 136));
		expect(panel.Size.X).toEqual(new UDim(0.3, 0));
		expect(responsiveWidth.MinSize.X).toBe(280);
		expect(responsiveWidth.MaxSize.X).toBe(360);
	});

	it("renders the empty state", () => {
		parent = new Instance("Folder");
		hud = new QuestHud(parent);

		expect(findDescendant(hud.getRoot(), "QuestCount", "TextLabel").Text).toBe("0 ACTIVE");
		expect(findDescendant(hud.getRoot(), "EmptyState", "TextLabel").Text).toBe("No active quests");
	});

	it("renders quest progress and updates existing content", () => {
		parent = new Instance("Folder");
		hud = new QuestHud(parent);
		const quest: QuestClientView = {
			questId: "first_harvest",
			title: "The First Harvest",
			stageTitle: "An Offering from the Grove",
			objectives: [
				{
					id: "collect_olive",
					description: "Collect Sacred Olive Branches",
					progress: 2,
					required: 4,
				},
			],
		};

		hud.render([quest]);

		expect(findDescendant(hud.getRoot(), "QuestCount", "TextLabel").Text).toBe("1 ACTIVE");
		expect(findDescendant(hud.getRoot(), "QuestTitle", "TextLabel").Text).toBe("The First Harvest");
		expect(findDescendant(hud.getRoot(), "ObjectiveText", "TextLabel").Text).toContain("2/4");
		expect(findDescendant(hud.getRoot(), "ProgressFill", "Frame").Size.X.Scale).toBe(0.5);

		hud.render([]);
		expect(hud.getRoot().FindFirstChild("Quest_first_harvest", true)).toBeUndefined();
	});
});
