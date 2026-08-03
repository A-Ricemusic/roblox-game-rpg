import { describe, expect, it } from "@rbxts/jest-globals";
import { advanceLightCombo, LIGHT_COMBO_RESET_SECONDS } from "./LightCombo";

describe("advanceLightCombo", () => {
	it("cycles through all four attacks", () => {
		const first = advanceLightCombo(undefined, 10);
		const second = advanceLightCombo(first.state, 10.4);
		const third = advanceLightCombo(second.state, 10.8);
		const fourth = advanceLightCombo(third.state, 11.2);
		const wrapped = advanceLightCombo(fourth.state, 11.6);
		expect([first.step, second.step, third.step, fourth.step, wrapped.step]).toEqual([1, 2, 3, 4, 1]);
	});

	it("resets to the first attack after the combo window", () => {
		const first = advanceLightCombo(undefined, 20);
		expect(advanceLightCombo(first.state, 20 + LIGHT_COMBO_RESET_SECONDS + 0.01).step).toBe(1);
	});
});
