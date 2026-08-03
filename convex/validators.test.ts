import { describe, expect, it } from "vitest";

import {
	assertValidInventoryProfile,
	assertValidQuestProfile,
	type InventoryProfile,
	type QuestProfile,
} from "./validators";

function activeQuest() {
	return {
		questId: "quest",
		definitionVersion: 1,
		status: "Active" as const,
		currentStageIndex: 0,
		objectiveProgress: {
			objective: { progress: 1, processedSourceIds: ["source:1"] },
		},
		startedAt: 1,
		updatedAt: 1,
	};
}

function assertRejected(profile: unknown, message: string): void {
	expect(() => assertValidQuestProfile(profile as QuestProfile)).toThrow(message);
}

describe("quest profile semantic validation", () => {
	it("accepts a complete valid profile", () => {
		expect(() =>
			assertValidQuestProfile({
				schemaVersion: 1,
				activeQuests: { quest: activeQuest() },
				completedQuestIds: ["completed_quest"],
			}),
		).not.toThrow();
	});

	it("rejects malformed roots and completion IDs", () => {
		assertRejected(undefined, "schema version 1");
		assertRejected({ schemaVersion: 1, activeQuests: [], completedQuestIds: [] }, "schema version 1");
		assertRejected({ schemaVersion: 1, activeQuests: {}, completedQuestIds: [""] }, "completed quest ID");
		assertRejected(
			{ schemaVersion: 1, activeQuests: {}, completedQuestIds: ["duplicate", "duplicate"] },
			"duplicated",
		);
	});

	it("rejects invalid active quest invariants", () => {
		assertRejected(
			{
				schemaVersion: 1,
				activeQuests: { quest: { ...activeQuest(), status: "Completed" } },
				completedQuestIds: [],
			},
			"invalid status",
		);
		assertRejected(
			{ schemaVersion: 1, activeQuests: { quest: activeQuest() }, completedQuestIds: ["quest"] },
			"active and completed",
		);
		for (const [field, value] of [
			["definitionVersion", 0],
			["currentStageIndex", -1],
			["startedAt", 1.5],
			["updatedAt", Number.MAX_VALUE],
		] as const) {
			assertRejected(
				{
					schemaVersion: 1,
					activeQuests: { quest: { ...activeQuest(), [field]: value } },
					completedQuestIds: [],
				},
				field,
			);
		}
	});

	it("rejects invalid objective progress and source IDs", () => {
		const withObjective = (objectiveId: string, progress: number, sourceIds: string[]) => ({
			...activeQuest(),
			objectiveProgress: { [objectiveId]: { progress, processedSourceIds: sourceIds } },
		});
		assertRejected(
			{ schemaVersion: 1, activeQuests: { quest: withObjective("", 1, []) }, completedQuestIds: [] },
			"objective ID",
		);
		assertRejected(
			{ schemaVersion: 1, activeQuests: { quest: withObjective("objective", -1, []) }, completedQuestIds: [] },
			"progress",
		);
		assertRejected(
			{ schemaVersion: 1, activeQuests: { quest: withObjective("objective", 1, [""]) }, completedQuestIds: [] },
			"source ID",
		);
		assertRejected(
			{
				schemaVersion: 1,
				activeQuests: { quest: withObjective("objective", 1, ["source", "source"]) },
				completedQuestIds: [],
			},
			"duplicate source ID",
		);
	});
});

describe("inventory profile semantic validation", () => {
	it("accepts bounded item stacks and unique claimed pickups", () => {
		expect(() =>
			assertValidInventoryProfile({
				schemaVersion: 1,
				itemQuantities: { marble_fragment: 3 },
				claimedWorldPickupIds: ["ruins:marble:1"],
			}),
		).not.toThrow();
	});

	it("rejects malformed quantities and duplicate pickup IDs", () => {
		expect(() =>
			assertValidInventoryProfile({
				schemaVersion: 1,
				itemQuantities: { marble_fragment: -1 },
				claimedWorldPickupIds: [],
			}),
		).toThrow("quantity");
		expect(() =>
			assertValidInventoryProfile({
				schemaVersion: 1,
				itemQuantities: {},
				claimedWorldPickupIds: ["same", "same"],
			}),
		).toThrow("duplicated");
		expect(() => assertValidInventoryProfile(undefined as unknown as InventoryProfile)).toThrow("schema version 1");
	});
});
