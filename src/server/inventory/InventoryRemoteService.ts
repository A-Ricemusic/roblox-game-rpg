import {
	parseInventoryClientRequest,
	INVENTORY_REMOTE_EVENT_NAME,
	INVENTORY_REMOTES_FOLDER_NAME,
} from "shared/inventory/InventoryRemoteProtocol";
import { InventoryEquipmentResult, InventoryItemDefinition } from "shared/inventory/InventoryTypes";
import { buildInventorySnapshot } from "shared/inventory/InventoryViewModel";

import { InventoryProfileService } from "./InventoryProfileService";

const REQUEST_COOLDOWN_SECONDS = 0.25;
const EQUIPMENT_COOLDOWN_SECONDS = 0.15;

export interface InventoryEquipmentRequestHandler {
	setWeaponEquipped(
		player: Player,
		profileKey: string,
		itemId: string | undefined,
	): InventoryEquipmentResult | undefined;
}

export class InventoryRemoteService {
	private readonly lastSnapshotRequestAt = new Map<string, number>();
	private readonly lastEquipmentRequestAt = new Map<string, number>();

	public constructor(
		private readonly remote: RemoteEvent,
		private readonly inventories: InventoryProfileService,
		private readonly definitions: ReadonlyArray<InventoryItemDefinition>,
		private readonly equipment?: InventoryEquipmentRequestHandler,
		private readonly clock: () => number = os.clock,
	) {}

	public start(profileKeyForPlayer: (player: Player) => string): RBXScriptConnection {
		return this.remote.OnServerEvent.Connect((player, payload: unknown) => {
			const key = profileKeyForPlayer(player);
			if (!this.acceptRequest(key, payload)) return;
			const request = parseInventoryClientRequest(payload);
			if (request?.kind === "SetWeaponEquipped") {
				this.equipment?.setWeaponEquipped(player, key, request.itemId);
			}
			this.sendSnapshot(player, key);
		});
	}

	public acceptRequest(profileKey: string, payload: unknown): boolean {
		const request = parseInventoryClientRequest(payload);
		if (request === undefined) return false;
		const now = this.clock();
		const requests = request.kind === "RequestSnapshot" ? this.lastSnapshotRequestAt : this.lastEquipmentRequestAt;
		const cooldown = request.kind === "RequestSnapshot" ? REQUEST_COOLDOWN_SECONDS : EQUIPMENT_COOLDOWN_SECONDS;
		const previous = requests.get(profileKey);
		if (previous !== undefined && now - previous < cooldown) return false;
		requests.set(profileKey, now);
		return true;
	}

	public forget(profileKey: string): void {
		this.lastSnapshotRequestAt.delete(profileKey);
		this.lastEquipmentRequestAt.delete(profileKey);
	}

	public sendSnapshot(player: Player, profileKey: string): boolean {
		const profile = this.inventories.get(profileKey);
		if (profile === undefined) return false;
		this.remote.FireClient(player, buildInventorySnapshot(profile, this.definitions));
		return true;
	}
}

export function getOrCreateInventoryRemote(): RemoteEvent {
	const replicatedStorage = game.GetService("ReplicatedStorage");
	let folder = replicatedStorage.FindFirstChild(INVENTORY_REMOTES_FOLDER_NAME);
	if (folder === undefined) {
		folder = new Instance("Folder");
		folder.Name = INVENTORY_REMOTES_FOLDER_NAME;
		folder.Parent = replicatedStorage;
	}
	assert(folder.IsA("Folder"), `${INVENTORY_REMOTES_FOLDER_NAME} must be a Folder.`);
	let remote = folder.FindFirstChild(INVENTORY_REMOTE_EVENT_NAME);
	if (remote === undefined) {
		remote = new Instance("RemoteEvent");
		remote.Name = INVENTORY_REMOTE_EVENT_NAME;
		remote.Parent = folder;
	}
	assert(remote.IsA("RemoteEvent"), `${INVENTORY_REMOTE_EVENT_NAME} must be a RemoteEvent.`);
	return remote;
}
