import { describe, expect, it } from "@rbxts/jest-globals";
import { getLightComboActiveWindow, getLightComboMotionDuration, sampleLightComboMotion } from "./SwordMotion";

describe("four-hit sword combo motion", () => {
	it("starts and ends every step in a neutral pose", () => {
		for (const step of [1, 2, 3, 4] as const) {
			expect(sampleLightComboMotion(step, 0)?.rightShoulder).toEqual(CFrame.identity);
			expect(sampleLightComboMotion(step, getLightComboMotionDuration(step))?.root).toEqual(CFrame.identity);
		}
	});

	it("uses distinct full-body strike poses", () => {
		const downward = sampleLightComboMotion(1, 0.33);
		const upward = sampleLightComboMotion(2, 0.31);
		const stab = sampleLightComboMotion(3, 0.38);
		expect(downward?.rightShoulder).never.toEqual(upward?.rightShoulder);
		expect(downward?.waist).never.toEqual(CFrame.identity);
		expect(upward?.leftShoulder).never.toEqual(CFrame.identity);
		expect(stab?.root.Position.Z).toBeLessThan(-0.4);
		expect(stab?.rightHip).never.toEqual(CFrame.identity);
	});

	it("samples distinct phases throughout the 360 spin", () => {
		const firstQuarter = sampleLightComboMotion(4, 0.33)?.root;
		const middle = sampleLightComboMotion(4, 0.5)?.root;
		const lastQuarter = sampleLightComboMotion(4, 0.67)?.root;
		expect(firstQuarter).never.toEqual(CFrame.identity);
		expect(middle).never.toEqual(firstQuarter);
		expect(lastQuarter).never.toEqual(middle);
	});

	it("is deterministic and rejects times outside each motion", () => {
		for (const step of [1, 2, 3, 4] as const) {
			const sampleTime = getLightComboMotionDuration(step) / 2;
			expect(sampleLightComboMotion(step, sampleTime)).toEqual(sampleLightComboMotion(step, sampleTime));
			expect(sampleLightComboMotion(step, -0.01)).toBeUndefined();
			expect(sampleLightComboMotion(step, getLightComboMotionDuration(step) + 0.01)).toBeUndefined();
		}
	});

	it("defines a bounded active strike window for every step", () => {
		for (const step of [1, 2, 3, 4] as const) {
			const [start, finish] = getLightComboActiveWindow(step);
			expect(start).toBeGreaterThan(0);
			expect(finish).toBeGreaterThan(start);
			expect(finish).toBeLessThan(getLightComboMotionDuration(step));
		}
	});
});
