import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import { InventoryClientController, InventoryClientRemote, InventoryToggleBinding } from "./InventoryClientController";
import { InventoryHud } from "./InventoryHud";

class FakeRemote implements InventoryClientRemote {
	private readonly event = new Instance("BindableEvent");
	public requests = 0;
	public readonly equipmentRequests = new Array<{ readonly itemId?: string }>();
	public onMessage(callback: (payload: unknown) => void): RBXScriptConnection {
		return this.event.Event.Connect(callback);
	}
	public requestSnapshot(): void {
		this.requests += 1;
	}
	public setWeaponEquipped(itemId: string | undefined): void {
		this.equipmentRequests.push({ itemId });
	}
	public emit(payload: unknown): void {
		this.event.Fire(payload);
	}
	public destroy(): void {
		this.event.Destroy();
	}
}

class FakeBinding implements InventoryToggleBinding {
	private callback?: () => void;
	public bind(callback: () => void): void {
		this.callback = callback;
	}
	public unbind(): void {
		this.callback = undefined;
	}
	public trigger(): void {
		this.callback?.();
	}
}

let parent: Folder | undefined;
let hud: InventoryHud | undefined;
let remote: FakeRemote | undefined;
let controller: InventoryClientController | undefined;

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

describe("InventoryClientController", () => {
	it("requests snapshots, toggles from abstract input, and renders valid data", () => {
		parent = new Instance("Folder");
		hud = new InventoryHud(parent);
		remote = new FakeRemote();
		const binding = new FakeBinding();
		controller = new InventoryClientController(hud, remote, binding);
		controller.start();
		expect(remote.requests).toBe(1);
		binding.trigger();
		expect(hud.isOpen()).toBe(true);
		expect(remote.requests).toBe(2);
		remote.emit({
			kind: "Snapshot",
			occupiedSlots: 1,
			maximumSlots: 200,
			items: [
				{
					itemId: "ambrosia_vial",
					displayName: "Vial of Ambrosia",
					description: "Divine nourishment.",
					category: "Consumable",
					quantity: 1,
					equipped: false,
				},
			],
		});
		const item = hud.getRoot().FindFirstChild("InventoryItem_ambrosia_vial", true);
		expect(item).toBeDefined();
	});

	it("ignores malformed server-authored snapshots", () => {
		parent = new Instance("Folder");
		hud = new InventoryHud(parent);
		remote = new FakeRemote();
		controller = new InventoryClientController(hud, remote, new FakeBinding());
		controller.start();
		remote.emit({ kind: "Snapshot", items: [{ itemId: 123 }] });
		expect(hud.getRoot().FindFirstChild("InventoryEmpty", true)).toBeDefined();
	});

	it("caches updates while closed and renders them only when opened", () => {
		parent = new Instance("Folder");
		hud = new InventoryHud(parent);
		remote = new FakeRemote();
		controller = new InventoryClientController(hud, remote, new FakeBinding());
		controller.start();
		remote.emit({
			kind: "Snapshot",
			occupiedSlots: 1,
			maximumSlots: 200,
			items: [
				{
					itemId: "marble_fragment",
					displayName: "Marble Fragment",
					description: "Ancient stone.",
					category: "Material",
					quantity: 2,
					equipped: false,
				},
			],
		});
		expect(hud.getRoot().FindFirstChild("InventoryItem_marble_fragment", true)).toBeUndefined();
		controller.toggle(true);
		expect(hud.getRoot().FindFirstChild("InventoryItem_marble_fragment", true)).toBeDefined();
	});

	it("forwards weapon equip and unequip intent without authoring inventory state", () => {
		parent = new Instance("Folder");
		hud = new InventoryHud(parent);
		remote = new FakeRemote();
		controller = new InventoryClientController(hud, remote, new FakeBinding());
		controller.start();
		controller.setWeaponEquipped("hoplite_sword");
		controller.setWeaponEquipped(undefined);
		expect(remote.equipmentRequests).toEqual([{ itemId: "hoplite_sword" }, {}]);
	});
});
