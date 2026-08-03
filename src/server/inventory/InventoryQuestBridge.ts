import { InventoryItemGrantedEvent } from "shared/inventory/InventoryTypes";
import { QuestEngineResult } from "shared/quests/QuestTypes";

import { QuestProfileService } from "server/quests/QuestProfileService";

/** Publishes successful inventory grants to quests without making inventory quest-aware. */
export class InventoryQuestBridge {
	public constructor(private readonly quests: QuestProfileService) {}

	public itemGranted(
		profileKey: string,
		event: InventoryItemGrantedEvent,
		now = os.time(),
	): QuestEngineResult | undefined {
		return this.quests.applyCollectible(
			profileKey,
			{
				kind: "CollectibleAcquired",
				itemId: event.itemId,
				quantity: event.quantity,
				source: "WorldTag",
				sourceId: event.transactionId,
			},
			now,
		);
	}
}
