import {
	parseInventoryClientRequest,
	INVENTORY_REMOTE_EVENT_NAME,
	INVENTORY_REMOTES_FOLDER_NAME,
} from "shared/inventory/InventoryRemoteProtocol";
import { InventoryItemDefinition } from "shared/inventory/InventoryTypes";
import { buildInventorySnapshot } from "shared/inventory/InventoryViewModel";

import { InventoryProfileService } from "./InventoryProfileService";

const REQUEST_COOLDOWN_SECONDS = 0.25;

export class InventoryRemoteService {
	private readonly lastRequestAt = new Map<string, number>();

	public constructor(
		private readonly remote: RemoteEvent,
		private readonly inventories: InventoryProfileService,
		private readonly definitions: ReadonlyArray<InventoryItemDefinition>,
		private readonly clock: () => number = os.clock,
	) {}

	public start(profileKeyForPlayer: (player: Player) => string): RBXScriptConnection {
		return this.remote.OnServerEvent.Connect((player, payload: unknown) => {
			const key = profileKeyForPlayer(player);
			if (this.acceptRequest(key, payload)) this.sendSnapshot(player, key);
		});
	}

	public acceptRequest(profileKey: string, payload: unknown): boolean {
		if (parseInventoryClientRequest(payload) === undefined) return false;
		const now = this.clock();
		const previous = this.lastRequestAt.get(profileKey);
		if (previous !== undefined && now - previous < REQUEST_COOLDOWN_SECONDS) return false;
		this.lastRequestAt.set(profileKey, now);
		return true;
	}

	public forget(profileKey: string): void {
		this.lastRequestAt.delete(profileKey);
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
