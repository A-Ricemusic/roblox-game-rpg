import { describe, expect, it } from "@rbxts/jest-globals";

import { sampleHopliteSwordIdle, sampleHopliteSwordRun } from "./SwordLocomotion";

describe("Hoplite sword locomotion", () => {
	it("produces a breathing equipped idle instead of the default identity pose", () => {
		const start = sampleHopliteSwordIdle(0);
		const breath = sampleHopliteSwordIdle(0.4);
		expect(start.rightShoulder).never.toEqual(CFrame.identity);
		expect(breath.root).never.toEqual(start.root);
	});

	it("alternates the legs while preserving the guarded sword arm", () => {
		const rightStep = sampleHopliteSwordRun(math.pi / 2, 1);
		const leftStep = sampleHopliteSwordRun((math.pi * 3) / 2, 1);
		expect(rightStep.rightHip).never.toEqual(leftStep.rightHip);
		expect(rightStep.leftHip).never.toEqual(leftStep.leftHip);
		expect(rightStep.rightShoulder).never.toEqual(CFrame.identity);
		expect(leftStep.rightShoulder).never.toEqual(CFrame.identity);
	});
});
