import { LightComboStep } from "shared/weapons/LightCombo";

export interface TrajectorySample {
	readonly elapsedSeconds: number;
	readonly tipPosition: Vector3;
	readonly bladeStartPosition: Vector3;
	readonly bladeEndPosition: Vector3;
	readonly torsoPosition: Vector3;
}

export interface MotionDiagnosticReport {
	readonly step: LightComboStep;
	readonly sampleCount: number;
	readonly horizontalTravel: number;
	readonly verticalTravel: number;
	readonly forwardTravel: number;
	readonly minimumTorsoClearance: number;
	readonly minimumBladeClearance: number;
	readonly passed: boolean;
	readonly issues: ReadonlyArray<string>;
}

function distanceFromPointToSegment(point: Vector3, segmentStart: Vector3, segmentEnd: Vector3): number {
	const segment = segmentEnd.sub(segmentStart);
	const lengthSquared = segment.Dot(segment);
	if (lengthSquared <= 0.0001) return point.sub(segmentStart).Magnitude;
	const alpha = math.clamp(point.sub(segmentStart).Dot(segment) / lengthSquared, 0, 1);
	return point.sub(segmentStart.add(segment.mul(alpha))).Magnitude;
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
	let minimumBladeClearance = math.huge;
	for (const sample of samples) {
		minimumTorsoClearance = math.min(minimumTorsoClearance, sample.tipPosition.sub(sample.torsoPosition).Magnitude);
		minimumBladeClearance = math.min(
			minimumBladeClearance,
			distanceFromPointToSegment(sample.torsoPosition, sample.bladeStartPosition, sample.bladeEndPosition),
		);
	}
	if (samples.isEmpty()) {
		minimumTorsoClearance = 0;
		minimumBladeClearance = 0;
	}

	const issues = new Array<string>();
	if (samples.size() < 8) issues.push("Too few trajectory samples");
	if (minimumTorsoClearance < 1.25) issues.push("Sword tip enters the torso safety radius");
	if (minimumBladeClearance < 0.9) issues.push("Sword blade intersects the torso safety radius");

	if (step === 1 || step === 2) {
		if (horizontalTravel < 1.75) issues.push("Diagonal slash lacks horizontal travel");
		if (verticalTravel < 1.75) issues.push("Diagonal slash lacks vertical travel");
		const first = localTips[0];
		const last = localTips[localTips.size() - 1];
		if (first !== undefined && last !== undefined) {
			if (step === 1) {
				if (first.X - last.X < 1.5) issues.push("Downward slash does not travel right to left");
				if (first.Y - last.Y < 1.5) issues.push("Downward slash does not lose enough height");
			} else {
				if (last.X - first.X < 1.5) issues.push("Rising slash does not travel left to right");
				if (last.Y - first.Y < 1.5) issues.push("Rising slash does not gain enough height");
			}
		}
	} else if (step === 3) {
		if (forwardTravel < 1.5) issues.push("Thrust lacks forward extension");
		if (horizontalTravel > 2.25) issues.push("Thrust wanders too far sideways");
		if (verticalTravel > 1.75) issues.push("Thrust wanders too far vertically");
		const first = localTips[0];
		const last = localTips[localTips.size() - 1];
		if (first !== undefined && last !== undefined && first.Z - last.Z < 1.5)
			issues.push("Thrust tip does not finish forward of its launch point");
		const contactSample = samples[samples.size() - 1];
		if (contactSample !== undefined) {
			const bladeDirection = contactSample.bladeEndPosition.sub(contactSample.bladeStartPosition);
			if (bladeDirection.Magnitude > 0.001) {
				const localDirection = characterRoot.VectorToObjectSpace(bladeDirection.Unit);
				if (localDirection.Dot(new Vector3(0, 0, -1)) < 0.7)
					issues.push("Thrust blade is not aimed forward at contact");
			}
		}
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
		minimumBladeClearance,
		passed: issues.isEmpty(),
		issues,
	};
}
