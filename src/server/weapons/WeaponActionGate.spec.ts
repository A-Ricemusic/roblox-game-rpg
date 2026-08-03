import { describe, expect, it } from "@rbxts/jest-globals";
import { LIGHT_SWING_COOLDOWN_SECONDS } from "shared/weapons/WeaponConstants";
import { WeaponActionGate } from "./WeaponActionGate";

describe("WeaponActionGate", () => {
	it("rate-limits each player independently", () => {
		const gate = new WeaponActionGate();

		expect(gate.tryLightSwing(101, 10)).toBe(true);
		expect(gate.tryLightSwing(101, 10.1)).toBe(false);
		expect(gate.tryLightSwing(202, 10.1)).toBe(true);
		expect(gate.tryLightSwing(101, 10 + LIGHT_SWING_COOLDOWN_SECONDS)).toBe(true);
	});
});
