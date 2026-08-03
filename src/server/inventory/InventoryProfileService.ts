import { claimWorldPickup, setEquippedWeapon } from "shared/inventory/InventoryEngine";
import {
	InventoryEquipmentResult,
	InventoryGrantResult,
	InventoryItemDefinition,
	InventoryProfile,
	WorldPickupGrant,
} from "shared/inventory/InventoryTypes";

import { PlayerProfileService } from "server/player/PlayerProfileService";

/** Inventory-domain facade. It never creates, equips, or mutates Roblox Tools. */
export class InventoryProfileService {
	public constructor(
		private readonly playerProfiles: PlayerProfileService,
		private readonly definitions: ReadonlyArray<InventoryItemDefinition>,
	) {}

	public get(profileKey: string): InventoryProfile | undefined {
		if (this.playerProfiles.isUnavailable(profileKey)) return undefined;
		return this.playerProfiles.get(profileKey)?.inventoryProfile;
	}

	public claimWorldPickup(profileKey: string, grant: WorldPickupGrant): InventoryGrantResult | undefined {
		const profile = this.get(profileKey);
		if (profile === undefined) return undefined;
		const result = claimWorldPickup(profile, this.definitions, grant);
		if (result.ok) this.playerProfiles.updateInventoryProfile(profileKey, result.profile);
		return result;
	}

	public setEquippedWeapon(profileKey: string, itemId: string | undefined): InventoryEquipmentResult | undefined {
		const profile = this.get(profileKey);
		if (profile === undefined) return undefined;
		const result = setEquippedWeapon(profile, this.definitions, itemId);
		if (result.ok && result.changed) this.playerProfiles.updateInventoryProfile(profileKey, result.profile);
		return result;
	}
}
