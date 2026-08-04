import { describe, expect, it } from "@rbxts/jest-globals";

import { createInitialPlayerResourceSnapshot, normalizePlayerResource } from "./PlayerResourceTypes";

describe("PlayerResourceTypes", () => {
	it("starts stamina and magic full while health waits for a character", () => {
		expect(createInitialPlayerResourceSnapshot()).toEqual({
			health: { current: 0, maximum: 100 },
			stamina: { current: 100, maximum: 100 },
			magic: { current: 100, maximum: 100 },
		});
	});

	it("clamps resource values and rejects non-finite or invalid maxima", () => {
		expect(normalizePlayerResource(120, 100)).toEqual({ current: 100, maximum: 100 });
		expect(normalizePlayerResource(-5, 100)).toEqual({ current: 0, maximum: 100 });
		expect(normalizePlayerResource(math.huge, 100)).toEqual({ current: 0, maximum: 100 });
		expect(normalizePlayerResource(10, 0)).toEqual({ current: 0, maximum: 0 });
	});
});
