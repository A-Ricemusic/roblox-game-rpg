import { applyCollectibleAcquired } from "shared/quests/QuestEngine";
import { CollectibleAcquiredEvent, QuestDefinition, QuestEngineResult, QuestProfile } from "shared/quests/QuestTypes";

import { PlayerProfileService } from "server/player/PlayerProfileService";

/** Quest-domain facade over the aggregate player profile owner. */
export class QuestProfileService {
	public constructor(
		private readonly playerProfiles: PlayerProfileService,
		private readonly definitions: ReadonlyArray<QuestDefinition>,
	) {}

	public get(profileKey: string): QuestProfile | undefined {
		if (this.playerProfiles.isUnavailable(profileKey)) return undefined;
		return this.playerProfiles.get(profileKey)?.questProfile;
	}

	public applyCollectible(
		profileKey: string,
		event: CollectibleAcquiredEvent,
		now = os.time(),
	): QuestEngineResult | undefined {
		const profile = this.get(profileKey);
		if (profile === undefined) return undefined;
		const result = applyCollectibleAcquired(profile, this.definitions, event, now);
		if (result.profile !== profile) this.playerProfiles.updateQuestProfile(profileKey, result.profile);
		return result;
	}
}
