import { describe, expect, it } from "@rbxts/jest-globals";
import { evaluateMotionTrajectory, TrajectorySample } from "./MotionDiagnostics";

function makeSamples(points: ReadonlyArray<Vector3>): ReadonlyArray<TrajectorySample> {
	return points.map((tipPosition, index) => ({
		elapsedSeconds: index / 60,
		tipPosition,
		torsoPosition: new Vector3(0, 3, 0),
	}));
}

describe("animation lab motion diagnostics", () => {
	it("accepts a broad diagonal trajectory that clears the torso", () => {
		const samples = makeSamples([
			new Vector3(2.5, 6, -2),
			new Vector3(2, 5.5, -2),
			new Vector3(1.5, 5, -2),
			new Vector3(1, 4.5, -2),
			new Vector3(0.5, 4, -2),
			new Vector3(0, 3.5, -2),
			new Vector3(-0.5, 3, -2),
			new Vector3(-1, 2.5, -2),
		]);
		const report = evaluateMotionTrajectory(1, CFrame.identity, samples);

		expect(report.passed).toBe(true);
		expect(report.horizontalTravel).toBeGreaterThan(3);
		expect(report.verticalTravel).toBeGreaterThan(3);
	});

	it("rejects a thrust that does not extend forward", () => {
		const samples = makeSamples([
			new Vector3(1, 4, -2),
			new Vector3(1, 4, -2.05),
			new Vector3(1, 4, -2.1),
			new Vector3(1, 4, -2.15),
			new Vector3(1, 4, -2.2),
			new Vector3(1, 4, -2.25),
			new Vector3(1, 4, -2.3),
			new Vector3(1, 4, -2.35),
		]);
		const report = evaluateMotionTrajectory(3, CFrame.identity, samples);

		expect(report.passed).toBe(false);
		expect(report.issues.join(" ")).toContain("forward extension");
	});

	it("rejects an unsafe sword path through the torso", () => {
		const points = new Array<Vector3>();
		for (let index = 0; index < 8; index++) points.push(new Vector3(index * 0.3, 3, 0));
		const report = evaluateMotionTrajectory(2, CFrame.identity, makeSamples(points));

		expect(report.passed).toBe(false);
		expect(report.minimumTorsoClearance).toBe(0);
		expect(report.issues.join(" ")).toContain("torso safety radius");
	});
});
