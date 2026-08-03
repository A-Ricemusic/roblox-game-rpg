import { describe, expect, it } from "@rbxts/jest-globals";
import {
	LIGHT_SWING_ANTICIPATION_SECONDS,
	LIGHT_SWING_DURATION_SECONDS,
	LIGHT_SWING_FOLLOW_THROUGH_SECONDS,
	LIGHT_SWING_STRIKE_SECONDS,
	sampleLightSwing,
} from "./SwordMotion";

describe("sampleLightSwing", () => {
	it("starts and ends in the neutral pose", () => {
		expect(sampleLightSwing(0)?.rightShoulder).toEqual(CFrame.identity);
		expect(sampleLightSwing(LIGHT_SWING_DURATION_SECONDS)?.rightShoulder).toEqual(CFrame.identity);
	});

	it("produces distinct anticipation, strike, and follow-through poses", () => {
		const anticipation = sampleLightSwing(LIGHT_SWING_ANTICIPATION_SECONDS);
		const strike = sampleLightSwing(LIGHT_SWING_STRIKE_SECONDS);
		const followThrough = sampleLightSwing(LIGHT_SWING_FOLLOW_THROUGH_SECONDS);

		expect(anticipation?.rightShoulder).never.toEqual(CFrame.identity);
		expect(strike?.rightShoulder).never.toEqual(anticipation?.rightShoulder);
		expect(followThrough?.rightShoulder).never.toEqual(strike?.rightShoulder);
		expect(strike?.waist).never.toEqual(anticipation?.waist);
	});

	it("samples deterministic poses", () => {
		const sampleTime = 0.2;
		expect(sampleLightSwing(sampleTime)).toEqual(sampleLightSwing(sampleTime));
	});

	it("has ordered phase timings within the motion", () => {
		expect(LIGHT_SWING_ANTICIPATION_SECONDS).toBeLessThan(LIGHT_SWING_STRIKE_SECONDS);
		expect(LIGHT_SWING_STRIKE_SECONDS).toBeLessThan(LIGHT_SWING_FOLLOW_THROUGH_SECONDS);
		expect(LIGHT_SWING_FOLLOW_THROUGH_SECONDS).toBeLessThan(LIGHT_SWING_DURATION_SECONDS);
	});

	it("rejects times outside the motion", () => {
		expect(sampleLightSwing(-0.01)).toBeUndefined();
		expect(sampleLightSwing(LIGHT_SWING_DURATION_SECONDS + 0.01)).toBeUndefined();
	});
});
