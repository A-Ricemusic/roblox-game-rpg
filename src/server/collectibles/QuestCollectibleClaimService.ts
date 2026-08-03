import { QuestEngineResult } from "shared/quests/QuestTypes";

import { QuestProfileService } from "server/quests/QuestProfileService";

import { isCharacterWithinCollectibleDistance } from "./CollectibleMetadata";
import { CollectibleRegistry } from "./CollectibleRegistry";

export type CollectibleClaimResult =
	| { readonly ok: true; readonly questResult: QuestEngineResult }
	| {
			readonly ok: false;
			readonly reason: "Unregistered" | "TooFar" | "ProfileNotLoaded";
	  };

export class QuestCollectibleClaimService {
	public constructor(
		private readonly registry: CollectibleRegistry,
		private readonly profiles: QuestProfileService,
		private readonly maxInteractionDistance = 16,
	) {
		assert(
			maxInteractionDistance >= 0 && maxInteractionDistance < math.huge,
			"Maximum collectible interaction distance must be finite and non-negative.",
		);
	}

	public claim(
		profileKey: string,
		character: Model | undefined,
		collectible: Instance,
		now = os.time(),
	): CollectibleClaimResult {
		const metadata = this.registry.get(collectible);
		if (metadata === undefined) {
			return { ok: false, reason: "Unregistered" };
		}
		if (!isCharacterWithinCollectibleDistance(character, collectible, this.maxInteractionDistance)) {
			return { ok: false, reason: "TooFar" };
		}

		const questResult = this.profiles.applyCollectible(
			profileKey,
			{
				kind: "CollectibleAcquired",
				itemId: metadata.itemId,
				quantity: metadata.quantity,
				source: "WorldTag",
				sourceId: metadata.collectibleId,
			},
			now,
		);
		return questResult === undefined ? { ok: false, reason: "ProfileNotLoaded" } : { ok: true, questResult };
	}
}
