import { describe, expect, it } from "@rbxts/jest-globals";

import { getBanditCombatDecision } from "./BanditCombatDecision";

describe("BanditCombatDecision", () => {
	it("makes melee enemies advance until sword range", () => {
		expect(getBanditCombatDecision(8, false, 5.5, 0)).toBe("Advance");
		expect(getBanditCombatDecision(4, false, 5.5, 0)).toBe("Attack");
	});

	it("makes ranged enemies maintain distance and attack from range", () => {
		expect(getBanditCombatDecision(60, true, 55, 28)).toBe("Advance");
		expect(getBanditCombatDecision(30, true, 55, 28)).toBe("Attack");
		expect(getBanditCombatDecision(10, true, 55, 28)).toBe("Retreat");
	});
});
