import { describe, expect, it } from "@rbxts/jest-globals";

import { createTestPlayerServices } from "server/player/testing/createTestPlayerServices";

import { InventoryQuestBridge } from "./InventoryQuestBridge";

describe("InventoryQuestBridge", () => {
	it("forwards only successful server inventory facts and keeps retries idempotent", () => {
		const services = createTestPlayerServices();
		services.playerProfiles.load("player:1", 10);
		const grant = services.inventories.claimWorldPickup("player:1", {
			pickupId: "grove:olive:bridge",
			itemId: "sacred_olive_branch",
			quantity: 2,
		});
		assert(grant !== undefined && grant.ok);
		const bridge = new InventoryQuestBridge(services.quests);
		const first = bridge.itemGranted("player:1", grant.event, 11);
		const duplicate = bridge.itemGranted("player:1", grant.event, 12);
		expect(first?.changes[0].progress).toBe(2);
		expect(duplicate?.changes).toHaveLength(0);
	});
});
