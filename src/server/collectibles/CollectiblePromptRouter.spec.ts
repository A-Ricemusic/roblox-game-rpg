import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import { CollectibleClaimResult } from "./QuestCollectibleClaimService";
import {
	CollectiblePromptRouter,
	InventoryPromptCoordinator,
	LegacyCollectibleClaims,
	PlayerSnapshotPublisher,
	PromptTargetRegistry,
} from "./CollectiblePromptRouter";
import { InventoryPickupCoordinationResult } from "server/inventory/InventoryPickupCoordinator";

class FakeRegistry implements PromptTargetRegistry {
	public constructor(public target?: Instance) {}
	public findRegisteredAncestor(_instance: Instance): Instance | undefined {
		return this.target;
	}
}

class FakeInventoryCoordinator implements InventoryPromptCoordinator {
	public calls = 0;
	public constructor(public result: InventoryPickupCoordinationResult) {}
	public claim(_profileKey: string, _character: Model | undefined, _pickup: Instance) {
		this.calls += 1;
		return this.result;
	}
}

class FakeLegacyClaims implements LegacyCollectibleClaims {
	public calls = 0;
	public constructor(public result: CollectibleClaimResult) {}
	public claim(_profileKey: string, _character: Model | undefined, _collectible: Instance) {
		this.calls += 1;
		return this.result;
	}
}

class FakeSnapshots implements PlayerSnapshotPublisher {
	public calls = 0;
	public sendSnapshot(_player: Player, _profileKey: string): boolean {
		this.calls += 1;
		return true;
	}
}

const instances = new Array<Instance>();

afterEach(() => {
	for (const instance of instances) instance.Destroy();
	instances.clear();
});

describe("CollectiblePromptRouter", () => {
	it("prefers a dual-tagged inventory pickup and refreshes both changed domains", () => {
		const pickup = new Instance("Part");
		const prompt = new Instance("ProximityPrompt");
		const playerInstance = new Instance("Folder");
		const player = playerInstance as unknown as Player;
		instances.push(pickup, prompt, playerInstance);
		const inventory = new FakeInventoryCoordinator({
			ok: true,
			event: {
				kind: "ItemGranted",
				transactionId: "world-pickup:test",
				itemId: "marble_fragment",
				quantity: 1,
				source: "WorldPickup",
			},
			questResult: {
				profile: { schemaVersion: 1, activeQuests: {}, completedQuestIds: [] },
				changes: [
					{
						questId: "quest",
						objectiveId: "objective",
						previousProgress: 0,
						progress: 1,
						required: 1,
						stageCompleted: true,
						questCompleted: true,
					},
				],
			},
		});
		const legacy = new FakeLegacyClaims({ ok: false, reason: "Unregistered" });
		const inventorySnapshots = new FakeSnapshots();
		const questSnapshots = new FakeSnapshots();
		const router = new CollectiblePromptRouter(
			new FakeRegistry(pickup),
			inventory,
			inventorySnapshots,
			questSnapshots,
			new FakeRegistry(pickup),
			legacy,
		);

		expect(router.handle(prompt, player, undefined, "player:1")).toBe("InventoryPickup");
		expect(inventory.calls).toBe(1);
		expect(legacy.calls).toBe(0);
		expect(inventorySnapshots.calls).toBe(1);
		expect(questSnapshots.calls).toBe(1);
	});
});
