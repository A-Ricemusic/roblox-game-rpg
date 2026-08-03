import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import { QuestClientController, QuestClientRemote } from "./QuestClientController";
import { QuestHud } from "./QuestHud";

class FakeQuestClientRemote implements QuestClientRemote {
	private readonly event = new Instance("BindableEvent");
	public requests = 0;

	public onMessage(callback: (payload: unknown) => void): RBXScriptConnection {
		return this.event.Event.Connect(callback);
	}

	public requestSnapshot(): void {
		this.requests += 1;
	}

	public emit(payload: unknown): void {
		this.event.Fire(payload);
	}

	public destroy(): void {
		this.event.Destroy();
	}
}

let parent: Folder | undefined;
let hud: QuestHud | undefined;
let remote: FakeQuestClientRemote | undefined;
let controller: QuestClientController | undefined;

afterEach(() => {
	controller?.stop();
	remote?.destroy();
	hud?.destroy();
	parent?.Destroy();
	controller = undefined;
	remote = undefined;
	hud = undefined;
	parent = undefined;
});

describe("QuestClientController", () => {
	it("requests an initial snapshot and renders valid updates", () => {
		parent = new Instance("Folder");
		hud = new QuestHud(parent);
		remote = new FakeQuestClientRemote();
		controller = new QuestClientController(hud, remote);
		controller.start();

		expect(remote.requests).toBe(1);
		remote.emit({
			kind: "Snapshot",
			quests: [
				{
					questId: "olive",
					title: "The First Harvest",
					stageTitle: "Gather",
					objectives: [{ id: "collect", description: "Collect", progress: 1, required: 3 }],
				},
			],
		});

		const count = hud.getRoot().FindFirstChild("QuestCount", true);
		assert(count !== undefined && count.IsA("TextLabel"));
		expect(count.Text).toBe("1 ACTIVE");
	});

	it("ignores malformed server payloads", () => {
		parent = new Instance("Folder");
		hud = new QuestHud(parent);
		remote = new FakeQuestClientRemote();
		controller = new QuestClientController(hud, remote);
		controller.start();
		remote.emit({ kind: "Snapshot", quests: [{ questId: 123 }] });

		const count = hud.getRoot().FindFirstChild("QuestCount", true);
		assert(count !== undefined && count.IsA("TextLabel"));
		expect(count.Text).toBe("0 ACTIVE");
	});
});
