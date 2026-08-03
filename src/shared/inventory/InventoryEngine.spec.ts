import { describe, expect, it } from "@rbxts/jest-globals";

import { INVENTORY_ITEM_DEFINITIONS } from "./InventoryDefinitions";
import { claimWorldPickup, createEmptyInventoryProfile } from "./InventoryEngine";
import { MAX_CLAIMED_WORLD_PICKUPS } from "./InventoryTypes";

describe("InventoryEngine", () => {
	it("grants a known world pickup immutably and records its transaction", () => {
		const original = createEmptyInventoryProfile();
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
		const first = claimWorldPickup(createEmptyInventoryProfile(), INVENTORY_ITEM_DEFINITIONS, {
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

	it("applies stack and persisted pickup-history limits atomically", () => {
		const fullStack = {
			...createEmptyInventoryProfile(),
			itemQuantities: { sacred_olive_branch: 99 },
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
		const fullHistory = { ...createEmptyInventoryProfile(), claimedWorldPickupIds };
		expect(
			claimWorldPickup(fullHistory, INVENTORY_ITEM_DEFINITIONS, {
				pickupId: "pickup:overflow",
				itemId: "marble_fragment",
				quantity: 1,
			}),
		).toEqual({ ok: false, reason: "PickupHistoryFull" });
	});
});
