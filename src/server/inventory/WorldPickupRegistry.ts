import { CollectionService } from "@rbxts/services";

import { INVENTORY_PICKUP_TAG, validateWorldPickupMetadata, WorldPickupMetadata } from "./WorldPickupMetadata";

export interface InventoryPickupTagSource {
	getTagged(): Instance[];
	onAdded(callback: (instance: Instance) => void): RBXScriptConnection;
	onRemoved(callback: (instance: Instance) => void): RBXScriptConnection;
}

export class RobloxInventoryPickupTagSource implements InventoryPickupTagSource {
	public getTagged(): Instance[] {
		return CollectionService.GetTagged(INVENTORY_PICKUP_TAG);
	}
	public onAdded(callback: (instance: Instance) => void): RBXScriptConnection {
		return CollectionService.GetInstanceAddedSignal(INVENTORY_PICKUP_TAG).Connect(callback);
	}
	public onRemoved(callback: (instance: Instance) => void): RBXScriptConnection {
		return CollectionService.GetInstanceRemovedSignal(INVENTORY_PICKUP_TAG).Connect(callback);
	}
}

export class WorldPickupRegistry {
	private readonly byInstance = new Map<Instance, WorldPickupMetadata>();
	private readonly instanceById = new Map<string, Instance>();
	private readonly connections = new Array<RBXScriptConnection>();
	private started = false;

	public constructor(
		private readonly source: InventoryPickupTagSource,
		private readonly isKnownItemId: (itemId: string) => boolean = () => true,
		private readonly reportInvalid: (instance: Instance, message: string) => void = (instance, message) =>
			warn(`[WorldPickupRegistry] ${instance.GetFullName()}: ${message}`),
	) {}

	public start(): void {
		if (this.started) return;
		this.started = true;
		this.connections.push(this.source.onAdded((instance) => this.register(instance)));
		this.connections.push(this.source.onRemoved((instance) => this.unregister(instance)));
		for (const instance of this.source.getTagged()) this.register(instance);
	}

	public stop(): void {
		for (const connection of this.connections) connection.Disconnect();
		this.connections.clear();
		this.byInstance.clear();
		this.instanceById.clear();
		this.started = false;
	}

	public get(instance: Instance): WorldPickupMetadata | undefined {
		return this.byInstance.get(instance);
	}

	public findRegisteredAncestor(instance: Instance): Instance | undefined {
		let current: Instance | undefined = instance;
		while (current !== undefined) {
			if (this.byInstance.has(current)) return current;
			current = current.Parent;
		}
		return undefined;
	}

	public size(): number {
		return this.byInstance.size();
	}

	private register(instance: Instance): void {
		if (this.byInstance.has(instance)) return;
		const result = validateWorldPickupMetadata(instance);
		if (!result.ok) {
			this.reportInvalid(instance, result.error);
			return;
		}
		if (!this.isKnownItemId(result.metadata.itemId)) {
			this.reportInvalid(instance, `Unknown inventory item ID '${result.metadata.itemId}'.`);
			return;
		}
		const existing = this.instanceById.get(result.metadata.pickupId);
		if (existing !== undefined && existing !== instance) {
			this.reportInvalid(instance, `Duplicate pickup ID '${result.metadata.pickupId}'.`);
			return;
		}
		this.byInstance.set(instance, result.metadata);
		this.instanceById.set(result.metadata.pickupId, instance);
	}

	private unregister(instance: Instance): void {
		const metadata = this.byInstance.get(instance);
		if (metadata === undefined) return;
		this.byInstance.delete(instance);
		if (this.instanceById.get(metadata.pickupId) !== instance) return;
		this.instanceById.delete(metadata.pickupId);
		for (const candidate of this.source.getTagged()) {
			if (candidate === instance || this.byInstance.has(candidate)) continue;
			const result = validateWorldPickupMetadata(candidate);
			if (!result.ok || result.metadata.pickupId !== metadata.pickupId) continue;
			this.register(candidate);
			if (this.byInstance.has(candidate)) return;
		}
	}
}
