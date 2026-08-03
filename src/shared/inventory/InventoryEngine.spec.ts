import { describe, expect, it } from "@rbxts/jest-globals";

import { INVENTORY_ITEM_DEFINITIONS } from "./InventoryDefinitions";
import { claimWorldPickup, createInitialInventoryProfile, setEquippedWeapon } from "./InventoryEngine";
import { MAX_CLAIMED_WORLD_PICKUPS, MAX_INVENTORY_ID_LENGTH, MAX_WORLD_PICKUP_ID_LENGTH } from "./InventoryTypes";

describe("InventoryEngine", () => {
	it("grants a known world pickup immutably and records its transaction", () => {
		const original = createInitialInventoryProfile();
		const result = claimWorldPickup(original, INVENTORY_ITEM_DEFINITIONS, {
			pickupId: "grove:olive:1",
			itemId: "sacred_olive_branch",
			quantity: 2,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(original.itemQuantities.sacred_olive_branch).toBeUndefined();
		expect(result.profile.itemQuantities.sacred_olive_branch).toBe(2);
		expect(result.event.transactionId).toBe("world-pickup:grove:olive:1");
	});

	it("rejects duplicate pickups, unknown items, and malformed grants", () => {
		const first = claimWorldPickup(createInitialInventoryProfile(), INVENTORY_ITEM_DEFINITIONS, {
			pickupId: "grove:olive:2",
			itemId: "sacred_olive_branch",
			quantity: 1,
		});
		assert(first.ok);
		expect(
			claimWorldPickup(first.profile, INVENTORY_ITEM_DEFINITIONS, {
				pickupId: "grove:olive:2",
				itemId: "sacred_olive_branch",
				quantity: 1,
			}),
		).toEqual({ ok: false, reason: "AlreadyClaimed" });
		expect(
			claimWorldPickup(first.profile, INVENTORY_ITEM_DEFINITIONS, {
				pickupId: "unknown:1",
				itemId: "not_registered",
				quantity: 1,
			}),
		).toEqual({ ok: false, reason: "UnknownItem" });
		expect(
			claimWorldPickup(first.profile, INVENTORY_ITEM_DEFINITIONS, {
				pickupId: "invalid:1",
				itemId: "sacred_olive_branch",
				quantity: 0,
			}),
		).toEqual({ ok: false, reason: "InvalidGrant" });
	});

	it("keeps the longest valid pickup transaction within persisted quest ID bounds", () => {
		const maximumPickupId = string.rep("p", MAX_WORLD_PICKUP_ID_LENGTH);
		const accepted = claimWorldPickup(createInitialInventoryProfile(), INVENTORY_ITEM_DEFINITIONS, {
			pickupId: maximumPickupId,
			itemId: "marble_fragment",
			quantity: 1,
		});
		expect(accepted.ok).toBe(true);
		if (accepted.ok) expect(accepted.event.transactionId.size()).toBe(MAX_INVENTORY_ID_LENGTH);
		expect(
			claimWorldPickup(createInitialInventoryProfile(), INVENTORY_ITEM_DEFINITIONS, {
				pickupId: `${maximumPickupId}x`,
				itemId: "marble_fragment",
				quantity: 1,
			}),
		).toEqual({ ok: false, reason: "InvalidGrant" });
	});

	it("applies stack and persisted pickup-history limits atomically", () => {
		const fullStack = {
			...createInitialInventoryProfile(),
			itemQuantities: { hoplite_sword: 1, sacred_olive_branch: 99 },
		};
		expect(
			claimWorldPickup(fullStack, INVENTORY_ITEM_DEFINITIONS, {
				pickupId: "olive:overflow",
				itemId: "sacred_olive_branch",
				quantity: 1,
			}),
		).toEqual({ ok: false, reason: "InventoryFull" });

		const claimedWorldPickupIds = new Array<string>();
		for (let index = 0; index < MAX_CLAIMED_WORLD_PICKUPS; index++) claimedWorldPickupIds.push(`pickup:${index}`);
		const fullHistory = { ...createInitialInventoryProfile(), claimedWorldPickupIds };
		expect(
			claimWorldPickup(fullHistory, INVENTORY_ITEM_DEFINITIONS, {
				pickupId: "pickup:overflow",
				itemId: "marble_fragment",
				quantity: 1,
			}),
		).toEqual({ ok: false, reason: "PickupHistoryFull" });
	});

	it("owns and equips the starter sword and supports authoritative unequip/re-equip", () => {
		const initial = createInitialInventoryProfile();
		expect(initial.itemQuantities.hoplite_sword).toBe(1);
		expect(initial.equipment.weapon).toBe("hoplite_sword");

		const unequipped = setEquippedWeapon(initial, INVENTORY_ITEM_DEFINITIONS, undefined);
		expect(unequipped.ok).toBe(true);
		if (!unequipped.ok) return;
		expect(unequipped.profile.equipment.weapon).toBeUndefined();
		const reequipped = setEquippedWeapon(unequipped.profile, INVENTORY_ITEM_DEFINITIONS, "hoplite_sword");
		expect(reequipped.ok).toBe(true);
		if (reequipped.ok) expect(reequipped.profile.equipment.weapon).toBe("hoplite_sword");
		expect(setEquippedWeapon(initial, INVENTORY_ITEM_DEFINITIONS, "ambrosia_vial")).toEqual({
			ok: false,
			reason: "NotEquippable",
		});
		expect(
			setEquippedWeapon({ ...initial, itemQuantities: {} }, INVENTORY_ITEM_DEFINITIONS, "hoplite_sword"),
		).toEqual({
			ok: false,
			reason: "NotOwned",
		});
		expect(setEquippedWeapon(initial, INVENTORY_ITEM_DEFINITIONS, "not_registered")).toEqual({
			ok: false,
			reason: "UnknownItem",
		});
	});
});
