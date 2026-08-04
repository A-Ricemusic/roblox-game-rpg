import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import { findNearestLivingTarget } from "./BanditTargeting";

const models = new Array<Model>();

function characterAt(position: Vector3, health = 100): Model {
	const model = new Instance("Model");
	models.push(model);
	const root = new Instance("Part");
	root.Name = "HumanoidRootPart";
	root.Position = position;
	root.Parent = model;
	const humanoid = new Instance("Humanoid");
	humanoid.Health = health;
	humanoid.Parent = model;
	return model;
}

afterEach(() => {
	for (const model of models) model.Destroy();
	models.clear();
});

describe("BanditTargeting", () => {
	it("selects the nearest living character inside detection range", () => {
		const far = characterAt(new Vector3(30, 0, 0));
		const near = characterAt(new Vector3(8, 0, 0));
		expect(findNearestLivingTarget(Vector3.zero, [far, near], 70)?.character).toBe(near);
	});

	it("ignores dead, malformed, and out-of-range characters", () => {
		const dead = characterAt(new Vector3(2, 0, 0), 0);
		const distant = characterAt(new Vector3(80, 0, 0));
		const malformed = new Instance("Model");
		models.push(malformed);
		expect(findNearestLivingTarget(Vector3.zero, [dead, distant, malformed, undefined], 70)).toBeUndefined();
	});
});
