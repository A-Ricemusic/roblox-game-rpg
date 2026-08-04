import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import { QuestClientView } from "shared/quests/QuestTypes";

import { QuestHud } from "./QuestHud";

let parent: Folder | undefined;
let hud: QuestHud | undefined;

const ACTIVE_QUEST: QuestClientView = {
	questId: "first_harvest",
	title: "The First Harvest",
	summary: "Gather an offering for the gods.",
	status: "Active",
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

const COMPLETED_QUEST: QuestClientView = {
	questId: "completed_journey",
	title: "A Hero's Welcome",
	summary: "The polis remembers your victory.",
	status: "Completed",
	stageTitle: "Journey complete",
	objectives: [],
};

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
	it("places a compact collapsed tracker directly beneath Inventory", () => {
		parent = new Instance("Folder");
		hud = new QuestHud(parent);
		const root = hud.getRoot();
		const tracker = findDescendant(root, "QuestTracker", "Frame");
		const body = findDescendant(root, "QuestTrackerBody", "Frame");

		expect(root.ScreenInsets).toBe(Enum.ScreenInsets.CoreUISafeInsets);
		expect(root.ClipToDeviceSafeArea).toBe(true);
		expect(tracker.Position).toEqual(new UDim2(0, 18, 0, 136));
		expect(findDescendant(root, "QuestTrackerToggle", "TextButton").Size).toEqual(new UDim2(0, 132, 0, 44));
		expect(body.Visible).toBe(false);
		expect(hud.isTrackerExpanded()).toBe(false);
	});

	it("expands a bounded scrolling tracker and renders only active quests", () => {
		parent = new Instance("Folder");
		hud = new QuestHud(parent);
		hud.render([ACTIVE_QUEST, COMPLETED_QUEST]);
		hud.setTrackerExpanded(true);

		expect(hud.isTrackerExpanded()).toBe(true);
		expect(findDescendant(hud.getRoot(), "QuestTrackerBody", "Frame").Visible).toBe(true);
		expect(findDescendant(hud.getRoot(), "QuestCount", "TextLabel").Text).toBe("1 ACTIVE");
		expect(hud.getRoot().FindFirstChild("TrackerQuest_first_harvest", true)).toBeDefined();
		expect(hud.getRoot().FindFirstChild("TrackerQuest_completed_journey", true)).toBeUndefined();
		expect(findDescendant(hud.getRoot(), "TrackerQuestList", "ScrollingFrame").Size.Y.Offset).toBe(176);
		expect(findDescendant(hud.getRoot(), "ObjectiveText", "TextLabel").Text).toContain("2/4");
		expect(findDescendant(hud.getRoot(), "ProgressFill", "Frame").Size.X.Scale).toBe(0.5);
	});

	it("opens a selectable journal with Active and All views", () => {
		parent = new Instance("Folder");
		hud = new QuestHud(parent);
		hud.render([ACTIVE_QUEST, COMPLETED_QUEST]);
		let beforeOpenCalls = 0;
		hud.setBeforeJournalOpen(() => (beforeOpenCalls += 1));
		hud.setJournalOpen(true);
		hud.setJournalOpen(true);
		expect(beforeOpenCalls).toBe(1);
		expect(hud.isJournalOpen()).toBe(true);
		expect(findDescendant(hud.getRoot(), "QuestJournalOverlay", "Frame").Visible).toBe(true);
		expect(hud.getJournalFilter()).toBe("Active");
		expect(hud.getSelectedQuestId()).toBe("first_harvest");
		expect(hud.getRoot().FindFirstChild("QuestLogEntry_completed_journey", true)).toBeUndefined();

		hud.setJournalFilter("All");
		expect(hud.getRoot().FindFirstChild("QuestLogEntry_completed_journey", true)).toBeDefined();
		expect(hud.selectQuest("completed_journey")).toBe(true);
		expect(findDescendant(hud.getRoot(), "SelectedQuestTitle", "TextLabel").Text).toBe("A Hero's Welcome");
		expect(findDescendant(hud.getRoot(), "CompletedQuestMessage", "TextLabel").Text).toContain("complete");
	});

	it("retains valid selection and falls back when a selected quest leaves the snapshot", () => {
		parent = new Instance("Folder");
		hud = new QuestHud(parent);
		hud.render([ACTIVE_QUEST, COMPLETED_QUEST]);
		hud.setJournalFilter("All");
		expect(hud.selectQuest("completed_journey")).toBe(true);
		hud.render([ACTIVE_QUEST, COMPLETED_QUEST]);
		expect(hud.getSelectedQuestId()).toBe("completed_journey");
		hud.render([ACTIVE_QUEST]);
		expect(hud.getSelectedQuestId()).toBe("first_harvest");
	});

	it("renders empty tracker and journal states", () => {
		parent = new Instance("Folder");
		hud = new QuestHud(parent);
		hud.setTrackerExpanded(true);
		hud.setJournalOpen(true);
		expect(findDescendant(hud.getRoot(), "TrackerEmpty", "TextLabel").Text).toContain("No active");
		expect(findDescendant(hud.getRoot(), "QuestJournalEmpty", "TextLabel").Text).toContain("No quests");
		expect(findDescendant(hud.getRoot(), "QuestDetailEmpty", "TextLabel").Text).toContain("Select");
	});
});
