import { describe, expect, it } from "@rbxts/jest-globals";

import { HOPLITE_SWORD_ATTACK_ANIMATIONS } from "./HopliteSwordAnimations";

describe("HopliteSwordAnimations", () => {
	it("defines one published authored animation for every combo step", () => {
		const ids = new Set<string>();
		for (const step of [1, 2, 3, 4] as const) {
			const definition = HOPLITE_SWORD_ATTACK_ANIMATIONS[step];
			expect(definition.animationId.match("^rbxassetid://%d+$")).never.toBeUndefined();
			expect(definition.durationSeconds).toBeGreaterThan(0);
			expect(definition.playbackSpeed * definition.durationSeconds).toBeCloseTo(definition.sourceDurationSeconds);
			ids.add(definition.animationId);
		}
		expect(ids.size()).toBe(4);
	});
});
