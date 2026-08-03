import { InventoryEquipmentResult } from "shared/inventory/InventoryTypes";

import { InventoryProfileService } from "./InventoryProfileService";

export interface WeaponEquipmentMaterializer {
	syncPlayerEquipment(player: Player, character?: Model): boolean;
}

/** Commits persistent inventory desired state before realizing it on the character. */
export class InventoryEquipmentCoordinator {
	public constructor(
		private readonly inventories: InventoryProfileService,
		private readonly materializer: WeaponEquipmentMaterializer,
	) {}

	public setWeaponEquipped(
		player: Player,
		profileKey: string,
		itemId: string | undefined,
	): InventoryEquipmentResult | undefined {
		const result = this.inventories.setEquippedWeapon(profileKey, itemId);
		if (result?.ok && result.changed && !this.materializer.syncPlayerEquipment(player)) {
			warn(`[InventoryEquipment] Weapon selection for '${profileKey}' is saved but still materializing.`);
		}
		return result;
	}

	public syncPlayer(player: Player): boolean {
		return this.materializer.syncPlayerEquipment(player);
	}
}
