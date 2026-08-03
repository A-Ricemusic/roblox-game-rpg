import { QuestProfile } from "./QuestTypes";

export const MAX_QUEST_DEFINITIONS = 1_024;
export const MAX_ACTIVE_QUESTS = 64;
export const MAX_QUEST_STAGES = 64;
export const MAX_OBJECTIVES_PER_STAGE = 32;
export const MAX_OBJECTIVE_REQUIREMENT = 2_048;
export const MAX_PROCESSED_SOURCES_PER_OBJECTIVE = MAX_OBJECTIVE_REQUIREMENT;
export const MAX_TOTAL_PROCESSED_SOURCE_IDS = 2_048;

export function validateQuestProfileLimits(profile: QuestProfile): string | undefined {
	let activeQuestCount = 0;
	let processedSourceCount = 0;
	for (const [questId, quest] of pairs(profile.activeQuests)) {
		activeQuestCount += 1;
		if (activeQuestCount > MAX_ACTIVE_QUESTS) {
			return `Quest profile exceeds ${MAX_ACTIVE_QUESTS} active quests.`;
		}
		let objectiveCount = 0;
		for (const [objectiveId, progress] of pairs(quest.objectiveProgress)) {
			objectiveCount += 1;
			if (objectiveCount > MAX_OBJECTIVES_PER_STAGE) {
				return `Active quest '${questId}' exceeds ${MAX_OBJECTIVES_PER_STAGE} objectives.`;
			}
			if (progress.processedSourceIds.size() > MAX_PROCESSED_SOURCES_PER_OBJECTIVE) {
				return `Objective '${objectiveId}' exceeds ${MAX_PROCESSED_SOURCES_PER_OBJECTIVE} processed sources.`;
			}
			processedSourceCount += progress.processedSourceIds.size();
			if (processedSourceCount > MAX_TOTAL_PROCESSED_SOURCE_IDS) {
				return `Quest profile exceeds ${MAX_TOTAL_PROCESSED_SOURCE_IDS} total processed sources.`;
			}
		}
	}
	if (profile.completedQuestIds.size() + activeQuestCount > MAX_QUEST_DEFINITIONS) {
		return `Quest profile exceeds ${MAX_QUEST_DEFINITIONS} tracked quests.`;
	}
	return undefined;
}
