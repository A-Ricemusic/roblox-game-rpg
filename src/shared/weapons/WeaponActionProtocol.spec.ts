import { describe, expect, it } from "@rbxts/jest-globals";
import { parseWeaponActionRequest } from "./WeaponActionProtocol";

describe("parseWeaponActionRequest", () => {
	it("accepts a valid light swing", () => {
		expect(parseWeaponActionRequest({ kind: "LightSwing", actionId: 12 })).toEqual({
			kind: "LightSwing",
			actionId: 12,
		});
	});

	it("rejects malformed and non-integral requests", () => {
		expect(parseWeaponActionRequest("LightSwing")).toBeUndefined();
		expect(parseWeaponActionRequest({ kind: "LightSwing", actionId: 1.5 })).toBeUndefined();
		expect(parseWeaponActionRequest({ kind: "HeavySwing", actionId: 1 })).toBeUndefined();
	});
});
