import { describe, expect, it } from "@rbxts/jest-globals";
import { LIGHT_COMBO_MINIMUM_INTERVALS, LIGHT_COMBO_RESET_SECONDS } from "shared/weapons/LightCombo";
import { WeaponActionGate } from "./WeaponActionGate";

describe("WeaponActionGate", () => {
	it("authoritatively sequences all four attacks", () => {
		const gate = new WeaponActionGate();
		let now = 10;
		expect(gate.tryLightSwing(101, now)).toBe(1);
		now += LIGHT_COMBO_MINIMUM_INTERVALS[1];
		expect(gate.tryLightSwing(101, now)).toBe(2);
		now += LIGHT_COMBO_MINIMUM_INTERVALS[2];
		expect(gate.tryLightSwing(101, now)).toBe(3);
		now += LIGHT_COMBO_MINIMUM_INTERVALS[3];
		expect(gate.tryLightSwing(101, now)).toBe(4);
		now += LIGHT_COMBO_MINIMUM_INTERVALS[4];
		expect(gate.tryLightSwing(101, now)).toBe(1);
	});

	it("does not advance on cooldown rejection and isolates players", () => {
		const gate = new WeaponActionGate();
		expect(gate.tryLightSwing(101, 10)).toBe(1);
		expect(gate.tryLightSwing(101, 10.1)).toBeUndefined();
		expect(gate.tryLightSwing(202, 10.1)).toBe(1);
		expect(gate.tryLightSwing(101, 10 + LIGHT_COMBO_MINIMUM_INTERVALS[1])).toBe(2);
	});

	it("resets after the combo window", () => {
		const gate = new WeaponActionGate();
		expect(gate.tryLightSwing(101, 30)).toBe(1);
		expect(gate.tryLightSwing(101, 30 + LIGHT_COMBO_RESET_SECONDS + 0.01)).toBe(1);
	});

	it("resets combo sequencing without clearing an active attack cooldown", () => {
		const gate = new WeaponActionGate();
		expect(gate.tryLightSwing(101, 10)).toBe(1);
		gate.resetCombo(101);
		expect(gate.tryLightSwing(101, 10.1)).toBeUndefined();
		expect(gate.tryLightSwing(101, 10 + LIGHT_COMBO_MINIMUM_INTERVALS[1])).toBe(1);
	});
});
