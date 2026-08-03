import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
	migrationStatusValidator,
	lastOperationValidator,
	inventoryProfileValidator,
	profileSessionValidator,
	questProfileValidator,
} from "./validators";

export default defineSchema({
	playerProfiles: defineTable({
		profileKey: v.string(),
		questProfile: questProfileValidator,
		inventoryProfile: v.optional(inventoryProfileValidator),
		migrationStatus: migrationStatusValidator,
		revision: v.number(),
		session: v.optional(profileSessionValidator),
		lastOperation: v.optional(lastOperationValidator),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_profile_key", ["profileKey"]),
});
