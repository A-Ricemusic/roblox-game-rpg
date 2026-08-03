import { InventoryItemGrantedEvent } from "shared/inventory/InventoryTypes";

import { InventoryProfileService } from "./InventoryProfileService";
import { isCharacterWithinPickupDistance } from "./WorldPickupMetadata";
import { WorldPickupRegistry } from "./WorldPickupRegistry";

export type WorldPickupClaimResult =
	| { readonly ok: true; readonly event: InventoryItemGrantedEvent }
	| {
			readonly ok: false;
			readonly reason:
				| "Unregistered"
				| "TooFar"
				| "ProfileNotLoaded"
				| "UnknownItem"
				| "InvalidGrant"
				| "AlreadyClaimed"
				| "InventoryFull"
				| "PickupHistoryFull";
	  };

export class WorldPickupClaimService {
	public constructor(
		private readonly registry: WorldPickupRegistry,
		private readonly inventories: InventoryProfileService,
		private readonly maximumDistance = 16,
	) {
		assert(maximumDistance >= 0 && maximumDistance < math.huge);
	}

	public claim(profileKey: string, character: Model | undefined, pickup: Instance): WorldPickupClaimResult {
		const metadata = this.registry.get(pickup);
		if (metadata === undefined) return { ok: false, reason: "Unregistered" };
		if (!isCharacterWithinPickupDistance(character, pickup, this.maximumDistance)) {
			return { ok: false, reason: "TooFar" };
		}
		const result = this.inventories.claimWorldPickup(profileKey, metadata);
		if (result === undefined) return { ok: false, reason: "ProfileNotLoaded" };
		return result.ok ? { ok: true, event: result.event } : result;
	}
}
