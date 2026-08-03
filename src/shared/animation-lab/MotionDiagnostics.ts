import { LightComboStep } from "shared/weapons/LightCombo";

export interface TrajectorySample {
	readonly elapsedSeconds: number;
	readonly tipPosition: Vector3;
	readonly torsoPosition: Vector3;
}

export interface MotionDiagnosticReport {
	readonly step: LightComboStep;
	readonly sampleCount: number;
	readonly horizontalTravel: number;
	readonly verticalTravel: number;
	readonly forwardTravel: number;
	readonly minimumTorsoClearance: number;
	readonly passed: boolean;
	readonly issues: ReadonlyArray<string>;
}

function getExtents(values: ReadonlyArray<number>): number {
	if (values.isEmpty()) return 0;
	let minimum = values[0];
	let maximum = values[0];
	for (const value of values) {
		minimum = math.min(minimum, value);
		maximum = math.max(maximum, value);
	}
	return maximum - minimum;
}

export function evaluateMotionTrajectory(
	step: LightComboStep,
	characterRoot: CFrame,
	samples: ReadonlyArray<TrajectorySample>,
): MotionDiagnosticReport {
	const localTips = samples.map((sample) => characterRoot.PointToObjectSpace(sample.tipPosition));
	const horizontalTravel = getExtents(localTips.map((position) => position.X));
	const verticalTravel = getExtents(localTips.map((position) => position.Y));
	const forwardTravel = getExtents(localTips.map((position) => position.Z));
	let minimumTorsoClearance = math.huge;
	for (const sample of samples) {
		minimumTorsoClearance = math.min(minimumTorsoClearance, sample.tipPosition.sub(sample.torsoPosition).Magnitude);
	}
	if (samples.isEmpty()) minimumTorsoClearance = 0;

	const issues = new Array<string>();
	if (samples.size() < 8) issues.push("Too few trajectory samples");
	if (minimumTorsoClearance < 1.25) issues.push("Sword tip enters the torso safety radius");

	if (step === 1 || step === 2) {
		if (horizontalTravel < 1.75) issues.push("Diagonal slash lacks horizontal travel");
		if (verticalTravel < 1.75) issues.push("Diagonal slash lacks vertical travel");
	} else if (step === 3) {
		if (forwardTravel < 1.5) issues.push("Thrust lacks forward extension");
		if (horizontalTravel > 2.25) issues.push("Thrust wanders too far sideways");
	} else {
		if (horizontalTravel < 3) issues.push("Spin slash radius is too small");
	}

	return {
		step,
		sampleCount: samples.size(),
		horizontalTravel,
		verticalTravel,
		forwardTravel,
		minimumTorsoClearance,
		passed: issues.isEmpty(),
		issues,
	};
}
