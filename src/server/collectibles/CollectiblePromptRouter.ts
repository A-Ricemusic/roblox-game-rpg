import { CollectibleClaimResult } from "./QuestCollectibleClaimService";
import { InventoryPickupCoordinationResult } from "server/inventory/InventoryPickupCoordinator";

export interface PromptTargetRegistry {
	findRegisteredAncestor(instance: Instance): Instance | undefined;
}

export interface InventoryPromptCoordinator {
	claim(profileKey: string, character: Model | undefined, pickup: Instance): InventoryPickupCoordinationResult;
}

export interface LegacyCollectibleClaims {
	claim(profileKey: string, character: Model | undefined, collectible: Instance): CollectibleClaimResult;
}

export interface PlayerSnapshotPublisher {
	sendSnapshot(player: Player, profileKey: string): boolean;
}

export type PromptRoute = "InventoryPickup" | "LegacyQuestCollectible" | "Unregistered";

/** Routes prompts through the canonical inventory path before legacy quest-only content. */
export class CollectiblePromptRouter {
	public constructor(
		private readonly inventoryRegistry: PromptTargetRegistry,
		private readonly inventoryCoordinator: InventoryPromptCoordinator,
		private readonly inventorySnapshots: PlayerSnapshotPublisher,
		private readonly questSnapshots: PlayerSnapshotPublisher,
		private readonly legacyRegistry: PromptTargetRegistry,
		private readonly legacyClaims: LegacyCollectibleClaims,
	) {}

	public handle(
		prompt: ProximityPrompt,
		player: Player,
		character: Model | undefined,
		profileKey: string,
	): PromptRoute {
		const pickup = this.inventoryRegistry.findRegisteredAncestor(prompt);
		if (pickup !== undefined) {
			const result = this.inventoryCoordinator.claim(profileKey, character, pickup);
			if (result.ok) {
				this.inventorySnapshots.sendSnapshot(player, profileKey);
				if (result.questResult !== undefined && result.questResult.changes.size() > 0) {
					this.questSnapshots.sendSnapshot(player, profileKey);
				}
			}
			return "InventoryPickup";
		}

		const collectible = this.legacyRegistry.findRegisteredAncestor(prompt);
		if (collectible === undefined) return "Unregistered";
		const result = this.legacyClaims.claim(profileKey, character, collectible);
		if (result.ok && result.questResult.changes.size() > 0) {
			this.questSnapshots.sendSnapshot(player, profileKey);
		}
		return "LegacyQuestCollectible";
	}
}
