import { CollectionService } from "@rbxts/services";

import { CollectibleMetadata, QUEST_COLLECTIBLE_TAG, validateCollectibleMetadata } from "./CollectibleMetadata";

export interface CollectionTagSource {
	getTagged(): Instance[];
	onAdded(callback: (instance: Instance) => void): RBXScriptConnection;
	onRemoved(callback: (instance: Instance) => void): RBXScriptConnection;
}

export class RobloxCollectionTagSource implements CollectionTagSource {
	public getTagged(): Instance[] {
		return CollectionService.GetTagged(QUEST_COLLECTIBLE_TAG);
	}

	public onAdded(callback: (instance: Instance) => void): RBXScriptConnection {
		return CollectionService.GetInstanceAddedSignal(QUEST_COLLECTIBLE_TAG).Connect(callback);
	}

	public onRemoved(callback: (instance: Instance) => void): RBXScriptConnection {
		return CollectionService.GetInstanceRemovedSignal(QUEST_COLLECTIBLE_TAG).Connect(callback);
	}
}

export class CollectibleRegistry {
	private readonly byInstance = new Map<Instance, CollectibleMetadata>();
	private readonly instancesById = new Map<string, Instance>();
	private readonly connections = new Array<RBXScriptConnection>();
	private started = false;

	public constructor(
		private readonly source: CollectionTagSource,
		private readonly reportInvalid: (instance: Instance, errorMessage: string) => void = (instance, errorMessage) =>
			warn(`[CollectibleRegistry] ${instance.GetFullName()}: ${errorMessage}`),
	) {}

	public start(): void {
		if (this.started) {
			return;
		}
		this.started = true;
		this.connections.push(this.source.onAdded((instance) => this.register(instance)));
		this.connections.push(this.source.onRemoved((instance) => this.unregister(instance)));
		for (const instance of this.source.getTagged()) {
			this.register(instance);
		}
	}

	public stop(): void {
		for (const connection of this.connections) {
			connection.Disconnect();
		}
		this.connections.clear();
		this.byInstance.clear();
		this.instancesById.clear();
		this.started = false;
	}

	public get(instance: Instance): CollectibleMetadata | undefined {
		return this.byInstance.get(instance);
	}

	public findRegisteredAncestor(instance: Instance): Instance | undefined {
		let current: Instance | undefined = instance;
		while (current !== undefined) {
			if (this.byInstance.has(current)) {
				return current;
			}
			current = current.Parent;
		}
		return undefined;
	}

	public size(): number {
		return this.byInstance.size();
	}

	private register(instance: Instance): void {
		if (this.byInstance.has(instance)) {
			return;
		}
		const result = validateCollectibleMetadata(instance);
		if (!result.ok) {
			this.reportInvalid(instance, result.error);
			return;
		}

		const existing = this.instancesById.get(result.metadata.collectibleId);
		if (existing !== undefined && existing !== instance) {
			this.reportInvalid(instance, `Duplicate collectible ID '${result.metadata.collectibleId}'.`);
			return;
		}

		this.byInstance.set(instance, result.metadata);
		this.instancesById.set(result.metadata.collectibleId, instance);
	}

	private unregister(instance: Instance): void {
		const metadata = this.byInstance.get(instance);
		if (metadata === undefined) {
			return;
		}
		this.byInstance.delete(instance);
		if (this.instancesById.get(metadata.collectibleId) === instance) {
			this.instancesById.delete(metadata.collectibleId);
		}
	}
}
