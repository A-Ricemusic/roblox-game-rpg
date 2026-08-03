import { describe, expect, it } from "@rbxts/jest-globals";

import { createTestPlayerServices } from "server/player/testing/createTestPlayerServices";

import { InventoryEquipmentCoordinator, WeaponEquipmentMaterializer } from "./InventoryEquipmentCoordinator";

class FakeMaterializer implements WeaponEquipmentMaterializer {
	public syncCalls = 0;

	public syncPlayerEquipment(_player: Player, _character?: Model): boolean {
		this.syncCalls += 1;
		return true;
	}
}

describe("InventoryEquipmentCoordinator", () => {
	it("commits desired state before materializing unequip and re-equip", () => {
		const services = createTestPlayerServices();
		expect(services.playerProfiles.load("player:equipment").ok).toBe(true);
		const materializer = new FakeMaterializer();
		const coordinator = new InventoryEquipmentCoordinator(services.inventories, materializer);
		const player = new Instance("Folder") as unknown as Player;

		const unequipped = coordinator.setWeaponEquipped(player, "player:equipment", undefined);
		expect(unequipped?.ok).toBe(true);
		expect(services.inventories.get("player:equipment")?.equipment.weapon).toBeUndefined();
		expect(materializer.syncCalls).toBe(1);

		const equipped = coordinator.setWeaponEquipped(player, "player:equipment", "hoplite_sword");
		expect(equipped?.ok).toBe(true);
		expect(services.inventories.get("player:equipment")?.equipment.weapon).toBe("hoplite_sword");
		expect(materializer.syncCalls).toBe(2);
		player.Destroy();
	});

	it("does not materialize rejected or unavailable requests", () => {
		const services = createTestPlayerServices();
		expect(services.playerProfiles.load("player:equipment").ok).toBe(true);
		const materializer = new FakeMaterializer();
		const coordinator = new InventoryEquipmentCoordinator(services.inventories, materializer);
		const player = new Instance("Folder") as unknown as Player;

		expect(coordinator.setWeaponEquipped(player, "player:equipment", "marble_fragment")).toEqual({
			ok: false,
			reason: "NotEquippable",
		});
		expect(coordinator.setWeaponEquipped(player, "player:missing", "hoplite_sword")).toBeUndefined();
		expect(materializer.syncCalls).toBe(0);
		player.Destroy();
	});
});
