import { InventoryItemGrantedEvent } from "shared/inventory/InventoryTypes";
import { QuestEngineResult } from "shared/quests/QuestTypes";

import { InventoryQuestBridge } from "./InventoryQuestBridge";
import { WorldPickupClaimResult, WorldPickupClaimService } from "./WorldPickupClaimService";

export type InventoryPickupCoordinationResult =
	| {
			readonly ok: true;
			readonly event: InventoryItemGrantedEvent;
			readonly questResult: QuestEngineResult | undefined;
	  }
	| Exclude<WorldPickupClaimResult, { readonly ok: true }>;

/** Owns the authoritative pickup transaction boundary and its quest notification. */
export class InventoryPickupCoordinator {
	public constructor(
		private readonly claims: WorldPickupClaimService,
		private readonly questBridge: InventoryQuestBridge,
	) {}

	public claim(
		profileKey: string,
		character: Model | undefined,
		pickup: Instance,
		now = os.time(),
	): InventoryPickupCoordinationResult {
		const result = this.claims.claim(profileKey, character, pickup);
		if (!result.ok) return result;
		return {
			ok: true,
			event: result.event,
			questResult: this.questBridge.itemGranted(profileKey, result.event, now),
		};
	}
}
