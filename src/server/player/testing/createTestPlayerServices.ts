import { INVENTORY_ITEM_DEFINITIONS } from "shared/inventory/InventoryDefinitions";
import { QUEST_DEFINITIONS } from "shared/quests/QuestDefinitions";

import { InventoryProfileService } from "server/inventory/InventoryProfileService";
import { QuestProfileService } from "server/quests/QuestProfileService";

import { PlayerProfileService } from "../PlayerProfileService";
import { ResilientPlayerProfileStore } from "../persistence/ResilientPlayerProfileStore";
import { FakePlayerProfileRepository } from "./FakePlayerProfileRepository";

export function createTestPlayerServices(repository = new FakePlayerProfileRepository()): {
	readonly repository: FakePlayerProfileRepository;
	readonly playerProfiles: PlayerProfileService;
	readonly quests: QuestProfileService;
	readonly inventories: InventoryProfileService;
} {
	const playerProfiles = new PlayerProfileService(
		new ResilientPlayerProfileStore(
			repository,
			{ maxAttempts: 2, baseDelaySeconds: 0, maxDelaySeconds: 0 },
			() => undefined,
		),
		QUEST_DEFINITIONS,
		INVENTORY_ITEM_DEFINITIONS,
	);
	return {
		repository,
		playerProfiles,
		quests: new QuestProfileService(playerProfiles, QUEST_DEFINITIONS),
		inventories: new InventoryProfileService(playerProfiles, INVENTORY_ITEM_DEFINITIONS),
	};
}
