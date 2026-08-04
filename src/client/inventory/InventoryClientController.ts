import { ContextActionService, ReplicatedStorage } from "@rbxts/services";

import {
	parseInventoryServerMessage,
	INVENTORY_REMOTE_EVENT_NAME,
	INVENTORY_REMOTES_FOLDER_NAME,
} from "shared/inventory/InventoryRemoteProtocol";
import { InventoryServerMessage } from "shared/inventory/InventoryTypes";

import { InventoryHud } from "./InventoryHud";

const TOGGLE_ACTION = "ToggleInventory";

export interface InventoryClientRemote {
	onMessage(callback: (payload: unknown) => void): RBXScriptConnection;
	requestSnapshot(): void;
	setWeaponEquipped(itemId: string | undefined): void;
}

export class RobloxInventoryClientRemote implements InventoryClientRemote {
	public constructor(private readonly remote = RobloxInventoryClientRemote.getRemote()) {}
	public onMessage(callback: (payload: unknown) => void): RBXScriptConnection {
		return this.remote.OnClientEvent.Connect(callback);
	}
	public requestSnapshot(): void {
		this.remote.FireServer({ kind: "RequestSnapshot" });
	}
	public setWeaponEquipped(itemId: string | undefined): void {
		this.remote.FireServer({ kind: "SetWeaponEquipped", itemId });
	}
	private static getRemote(): RemoteEvent {
		const folder = ReplicatedStorage.WaitForChild(INVENTORY_REMOTES_FOLDER_NAME);
		const remote = folder.WaitForChild(INVENTORY_REMOTE_EVENT_NAME);
		assert(remote.IsA("RemoteEvent"), `${INVENTORY_REMOTE_EVENT_NAME} must be a RemoteEvent.`);
		return remote;
	}
}

export interface InventoryToggleBinding {
	bind(callback: () => void): void;
	unbind(): void;
}

export class RobloxInventoryToggleBinding implements InventoryToggleBinding {
	public bind(callback: () => void): void {
		ContextActionService.BindAction(
			TOGGLE_ACTION,
			(_name, state) => {
				if (state === Enum.UserInputState.Begin) callback();
				return Enum.ContextActionResult.Sink;
			},
			false,
			Enum.KeyCode.I,
			Enum.KeyCode.ButtonY,
		);
	}
	public unbind(): void {
		ContextActionService.UnbindAction(TOGGLE_ACTION);
	}
}

export class InventoryClientController {
	private readonly connections = new Array<RBXScriptConnection>();
	private started = false;
	private latestSnapshot?: InventoryServerMessage;

	public constructor(
		private readonly hud: InventoryHud,
		private readonly remote: InventoryClientRemote = new RobloxInventoryClientRemote(),
		private readonly toggleBinding: InventoryToggleBinding = new RobloxInventoryToggleBinding(),
		private readonly beforeOpen?: () => void,
	) {}

	public start(): void {
		if (this.started) return;
		this.started = true;
		this.connections.push(
			this.remote.onMessage((payload) => {
				const snapshot = parseInventoryServerMessage(payload);
				if (snapshot === undefined) return;
				this.latestSnapshot = snapshot;
				if (this.hud.isOpen()) this.hud.render(snapshot);
			}),
		);
		this.connections.push(this.hud.getToggleButton().Activated.Connect(() => this.toggle(true)));
		this.connections.push(this.hud.getCloseButton().Activated.Connect(() => this.toggle(false)));
		this.hud.setEquipmentActionHandler((itemId) => this.setWeaponEquipped(itemId));
		this.toggleBinding.bind(() => this.toggle(!this.hud.isOpen()));
		this.remote.requestSnapshot();
	}

	public stop(): void {
		if (!this.started) return;
		for (const connection of this.connections) connection.Disconnect();
		this.connections.clear();
		this.toggleBinding.unbind();
		this.hud.setEquipmentActionHandler(undefined);
		this.started = false;
	}

	public toggle(open: boolean): void {
		if (open && !this.hud.isOpen()) this.beforeOpen?.();
		this.hud.setOpen(open);
		if (open) {
			if (this.latestSnapshot !== undefined) this.hud.render(this.latestSnapshot);
			this.remote.requestSnapshot();
		}
	}

	public setWeaponEquipped(itemId: string | undefined): void {
		if (!this.started) return;
		this.remote.setWeaponEquipped(itemId);
	}
}
