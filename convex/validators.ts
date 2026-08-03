import { type Infer, v } from "convex/values";

export const objectiveProgressValidator = v.object({
	progress: v.number(),
	processedSourceIds: v.array(v.string()),
});

export const activeQuestValidator = v.object({
	questId: v.string(),
	definitionVersion: v.number(),
	status: v.literal("Active"),
	currentStageIndex: v.number(),
	objectiveProgress: v.record(v.string(), objectiveProgressValidator),
	startedAt: v.number(),
	updatedAt: v.number(),
});

export const questProfileValidator = v.object({
	schemaVersion: v.literal(1),
	activeQuests: v.record(v.string(), activeQuestValidator),
	completedQuestIds: v.array(v.string()),
});

export type QuestProfile = Infer<typeof questProfileValidator>;

const MAX_PERSISTED_ID_LENGTH = 128;

function assertPersistedId(value: unknown, label: string): asserts value is string {
	if (typeof value !== "string" || value.length === 0 || value.length > MAX_PERSISTED_ID_LENGTH) {
		throw new Error(`${label} must contain between 1 and ${MAX_PERSISTED_ID_LENGTH} characters.`);
	}
}

function assertNonNegativeInteger(value: unknown, label: string, positive = false): asserts value is number {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
		throw new Error(`${label} must be a ${positive ? "positive" : "non-negative"} safe integer.`);
	}
}

export function assertValidQuestProfile(profile: QuestProfile): void {
	if (
		profile?.schemaVersion !== 1 ||
		typeof profile.activeQuests !== "object" ||
		profile.activeQuests === null ||
		Array.isArray(profile.activeQuests) ||
		!Array.isArray(profile.completedQuestIds)
	) {
		throw new Error("Quest profile does not match schema version 1.");
	}

	const completedQuestIds = new Set<string>();
	for (const questId of profile.completedQuestIds) {
		assertPersistedId(questId, "completed quest ID");
		if (completedQuestIds.has(questId)) throw new Error(`Completed quest '${questId}' is duplicated.`);
		completedQuestIds.add(questId);
	}

	for (const [questId, quest] of Object.entries(profile.activeQuests)) {
		assertPersistedId(questId, "active quest ID");
		if (quest.questId !== questId) throw new Error(`Active quest '${questId}' has a mismatched questId.`);
		if (quest.status !== "Active") throw new Error(`Active quest '${questId}' has an invalid status.`);
		if (completedQuestIds.has(questId)) throw new Error(`Quest '${questId}' cannot be active and completed.`);
		assertNonNegativeInteger(quest.definitionVersion, `Active quest '${questId}' definitionVersion`, true);
		assertNonNegativeInteger(quest.currentStageIndex, `Active quest '${questId}' currentStageIndex`);
		assertNonNegativeInteger(quest.startedAt, `Active quest '${questId}' startedAt`);
		assertNonNegativeInteger(quest.updatedAt, `Active quest '${questId}' updatedAt`);

		for (const [objectiveId, objective] of Object.entries(quest.objectiveProgress)) {
			assertPersistedId(objectiveId, `Active quest '${questId}' objective ID`);
			assertNonNegativeInteger(objective.progress, `Objective '${objectiveId}' progress`);
			const sourceIds = new Set<string>();
			for (const sourceId of objective.processedSourceIds) {
				assertPersistedId(sourceId, `Objective '${objectiveId}' source ID`);
				if (sourceIds.has(sourceId)) throw new Error(`Objective '${objectiveId}' has a duplicate source ID.`);
				sourceIds.add(sourceId);
			}
		}
	}
}

export const profileSessionValidator = v.object({
	id: v.string(),
	serverId: v.string(),
	acquiredAt: v.number(),
	expiresAt: v.number(),
});

export const operationKindValidator = v.union(v.literal("save"), v.literal("release"));
export const migrationStatusValidator = v.union(v.literal("pending"), v.literal("complete"));
export const lastOperationValidator = v.object({
	id: v.string(),
	kind: operationKindValidator,
	revision: v.number(),
});

export const acquireResultValidator = v.union(
	v.object({
		status: v.literal("ok"),
		profile: questProfileValidator,
		revision: v.number(),
		leaseExpiresAt: v.number(),
		migrationRequired: v.boolean(),
	}),
	v.object({
		status: v.literal("leased"),
		retryAfterMs: v.number(),
	}),
);

export const writeResultValidator = v.union(
	v.object({
		status: v.literal("ok"),
		revision: v.number(),
		leaseExpiresAt: v.optional(v.number()),
	}),
	v.object({ status: v.literal("session_conflict") }),
	v.object({ status: v.literal("revision_conflict"), actualRevision: v.number() }),
);
