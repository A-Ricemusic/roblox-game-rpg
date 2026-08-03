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

export const inventoryProfileValidator = v.object({
	schemaVersion: v.literal(1),
	itemQuantities: v.record(v.string(), v.number()),
	claimedWorldPickupIds: v.array(v.string()),
	equipment: v.optional(v.object({ schemaVersion: v.literal(1), weapon: v.optional(v.string()) })),
});

export const playerProfileValidator = v.object({
	schemaVersion: v.literal(1),
	questProfile: questProfileValidator,
	inventoryProfile: inventoryProfileValidator,
});

export type InventoryProfile = Infer<typeof inventoryProfileValidator>;
export type PlayerProfile = Infer<typeof playerProfileValidator>;

const MAX_PERSISTED_ID_LENGTH = 128;
const MAX_WORLD_PICKUP_ID_LENGTH = 115;
const MAX_TRACKED_QUESTS = 1_024;
const MAX_ACTIVE_QUESTS = 64;
const MAX_OBJECTIVES_PER_STAGE = 32;
const MAX_PROCESSED_SOURCES_PER_OBJECTIVE = 2_048;
const MAX_TOTAL_PROCESSED_SOURCE_IDS = 2_048;
const MAX_INVENTORY_ITEM_TYPES = 200;
const MAX_CLAIMED_WORLD_PICKUPS = 1_024;
const MAX_INVENTORY_STACK_QUANTITY = 1_000_000;
const STARTER_WEAPON_ID = "hoplite_sword";

function assertPersistedId(
	value: unknown,
	label: string,
	maximumLength = MAX_PERSISTED_ID_LENGTH,
): asserts value is string {
	if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) {
		throw new Error(`${label} must contain between 1 and ${maximumLength} characters.`);
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
	const activeQuestEntries = Object.entries(profile.activeQuests);
	if (activeQuestEntries.length > MAX_ACTIVE_QUESTS)
		throw new Error("Quest profile contains too many active quests.");
	if (activeQuestEntries.length + completedQuestIds.size > MAX_TRACKED_QUESTS) {
		throw new Error("Quest profile contains too many tracked quests.");
	}
	let processedSourceCount = 0;

	for (const [questId, quest] of activeQuestEntries) {
		assertPersistedId(questId, "active quest ID");
		if (quest.questId !== questId) throw new Error(`Active quest '${questId}' has a mismatched questId.`);
		if (quest.status !== "Active") throw new Error(`Active quest '${questId}' has an invalid status.`);
		if (completedQuestIds.has(questId)) throw new Error(`Quest '${questId}' cannot be active and completed.`);
		assertNonNegativeInteger(quest.definitionVersion, `Active quest '${questId}' definitionVersion`, true);
		assertNonNegativeInteger(quest.currentStageIndex, `Active quest '${questId}' currentStageIndex`);
		assertNonNegativeInteger(quest.startedAt, `Active quest '${questId}' startedAt`);
		assertNonNegativeInteger(quest.updatedAt, `Active quest '${questId}' updatedAt`);

		const objectiveEntries = Object.entries(quest.objectiveProgress);
		if (objectiveEntries.length > MAX_OBJECTIVES_PER_STAGE) {
			throw new Error(`Active quest '${questId}' contains too many objectives.`);
		}
		for (const [objectiveId, objective] of objectiveEntries) {
			assertPersistedId(objectiveId, `Active quest '${questId}' objective ID`);
			assertNonNegativeInteger(objective.progress, `Objective '${objectiveId}' progress`);
			const sourceIds = new Set<string>();
			if (objective.processedSourceIds.length > MAX_PROCESSED_SOURCES_PER_OBJECTIVE) {
				throw new Error(`Objective '${objectiveId}' contains too many processed source IDs.`);
			}
			processedSourceCount += objective.processedSourceIds.length;
			if (processedSourceCount > MAX_TOTAL_PROCESSED_SOURCE_IDS) {
				throw new Error("Quest profile contains too many total processed source IDs.");
			}
			for (const sourceId of objective.processedSourceIds) {
				assertPersistedId(sourceId, `Objective '${objectiveId}' source ID`);
				if (sourceIds.has(sourceId)) throw new Error(`Objective '${objectiveId}' has a duplicate source ID.`);
				sourceIds.add(sourceId);
			}
		}
	}
}

export function assertValidInventoryProfile(profile: InventoryProfile): void {
	if (
		profile?.schemaVersion !== 1 ||
		typeof profile.itemQuantities !== "object" ||
		profile.itemQuantities === null ||
		Array.isArray(profile.itemQuantities) ||
		!Array.isArray(profile.claimedWorldPickupIds)
	) {
		throw new Error("Inventory profile does not match schema version 1.");
	}
	const items = Object.entries(profile.itemQuantities);
	if (items.length > MAX_INVENTORY_ITEM_TYPES) throw new Error("Inventory contains too many item types.");
	for (const [itemId, quantity] of items) {
		assertPersistedId(itemId, "inventory item ID");
		assertNonNegativeInteger(quantity, `Inventory item '${itemId}' quantity`, true);
		if (quantity > MAX_INVENTORY_STACK_QUANTITY)
			throw new Error(`Inventory item '${itemId}' quantity is too large.`);
	}
	if (profile.claimedWorldPickupIds.length > MAX_CLAIMED_WORLD_PICKUPS) {
		throw new Error("Inventory contains too many claimed world pickups.");
	}
	const pickupIds = new Set<string>();
	for (const pickupId of profile.claimedWorldPickupIds) {
		assertPersistedId(pickupId, "claimed world pickup ID", MAX_WORLD_PICKUP_ID_LENGTH);
		if (pickupIds.has(pickupId)) throw new Error(`Claimed world pickup '${pickupId}' is duplicated.`);
		pickupIds.add(pickupId);
	}
	const starterWeaponQuantity = profile.itemQuantities[STARTER_WEAPON_ID];
	if (starterWeaponQuantity !== undefined && starterWeaponQuantity !== 1) {
		throw new Error(`Starter weapon '${STARTER_WEAPON_ID}' must be owned exactly once when present.`);
	}
	if (profile.equipment?.weapon !== undefined) {
		assertPersistedId(profile.equipment.weapon, "equipped weapon ID");
		if ((profile.itemQuantities[profile.equipment.weapon] ?? 0) < 1) {
			throw new Error(`Equipped weapon '${profile.equipment.weapon}' is not owned.`);
		}
	}
}

export function assertValidPlayerProfile(profile: PlayerProfile): void {
	if (profile?.schemaVersion !== 1) throw new Error("Player profile does not match schema version 1.");
	assertValidQuestProfile(profile.questProfile);
	assertValidInventoryProfile(profile.inventoryProfile);
}

export const profileSessionValidator = v.object({
	id: v.string(),
	serverId: v.string(),
	acquiredAt: v.number(),
	expiresAt: v.number(),
});

export const operationKindValidator = v.union(v.literal("save"), v.literal("release"), v.literal("abandon"));
export const migrationStatusValidator = v.union(v.literal("pending"), v.literal("complete"));
export const lastOperationValidator = v.object({
	id: v.string(),
	kind: operationKindValidator,
	revision: v.number(),
});

export const acquireResultValidator = v.union(
	v.object({
		status: v.literal("ok"),
		profile: playerProfileValidator,
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
