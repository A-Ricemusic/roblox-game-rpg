export const QUEST_PROFILE_SCHEMA_VERSION = 1;

export type QuestId = string;
export type QuestStageId = string;
export type QuestObjectiveId = string;
export type ItemId = string;

export interface CollectItemObjectiveDefinition {
	readonly id: QuestObjectiveId;
	readonly kind: "CollectItem";
	readonly description: string;
	readonly itemId: ItemId;
	readonly required: number;
	readonly allowedSources: ReadonlyArray<CollectibleSource>;
}

// Extend this union when the next objective handler is implemented.
export type QuestObjectiveDefinition = CollectItemObjectiveDefinition;

export interface QuestStageDefinition {
	readonly id: QuestStageId;
	readonly title: string;
	readonly objectives: ReadonlyArray<QuestObjectiveDefinition>;
}

export interface QuestDefinition {
	readonly id: QuestId;
	readonly version: number;
	readonly title: string;
	readonly summary: string;
	readonly autoStart: boolean;
	readonly stages: ReadonlyArray<QuestStageDefinition>;
}

export type CollectibleSource = "WorldTag";

export interface CollectibleAcquiredEvent {
	readonly kind: "CollectibleAcquired";
	readonly itemId: ItemId;
	readonly quantity: number;
	readonly source: CollectibleSource;
	readonly sourceId: string;
}

export interface ObjectiveProgressState {
	readonly progress: number;
	readonly processedSourceIds: ReadonlyArray<string>;
}

export type ActiveQuestStatus = "Active" | "Completed";

export interface ActiveQuestState {
	readonly questId: QuestId;
	readonly definitionVersion: number;
	readonly status: ActiveQuestStatus;
	readonly currentStageIndex: number;
	readonly objectiveProgress: Readonly<Record<QuestObjectiveId, ObjectiveProgressState>>;
	readonly startedAt: number;
	readonly updatedAt: number;
}

export interface QuestProfile {
	readonly schemaVersion: typeof QUEST_PROFILE_SCHEMA_VERSION;
	readonly activeQuests: Readonly<Record<QuestId, ActiveQuestState>>;
	readonly completedQuestIds: ReadonlyArray<QuestId>;
}

export interface QuestProgressChange {
	readonly questId: QuestId;
	readonly objectiveId: QuestObjectiveId;
	readonly previousProgress: number;
	readonly progress: number;
	readonly required: number;
	readonly stageCompleted: boolean;
	readonly questCompleted: boolean;
}

export interface QuestEngineResult {
	readonly profile: QuestProfile;
	readonly changes: ReadonlyArray<QuestProgressChange>;
}

export type QuestClientRequest = { readonly kind: "RequestSnapshot" };

export type QuestClientView = Readonly<{
	questId: QuestId;
	title: string;
	stageTitle: string;
	objectives: ReadonlyArray<{
		id: QuestObjectiveId;
		description: string;
		progress: number;
		required: number;
	}>;
}>;
