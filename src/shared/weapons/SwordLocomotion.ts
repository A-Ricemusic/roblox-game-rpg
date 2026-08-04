import { SwordPose } from "./SwordMotion";

function rotation(x: number, y: number, z: number): CFrame {
	return CFrame.Angles(math.rad(x), math.rad(y), math.rad(z));
}

function pose(overrides: Partial<SwordPose>): SwordPose {
	return {
		root: CFrame.identity,
		waist: CFrame.identity,
		neck: CFrame.identity,
		rightShoulder: CFrame.identity,
		rightElbow: CFrame.identity,
		rightWrist: CFrame.identity,
		leftShoulder: CFrame.identity,
		leftElbow: CFrame.identity,
		leftWrist: CFrame.identity,
		rightHip: CFrame.identity,
		rightKnee: CFrame.identity,
		rightAnkle: CFrame.identity,
		leftHip: CFrame.identity,
		leftKnee: CFrame.identity,
		leftAnkle: CFrame.identity,
		...overrides,
	};
}

export function sampleHopliteSwordIdle(elapsedSeconds: number): SwordPose {
	const breath = math.sin(elapsedSeconds * math.pi * 1.25);
	return pose({
		root: new CFrame(0, breath * 0.018, 0).mul(rotation(0, -4, 0)),
		waist: rotation(1.5 + breath * 0.6, -7, -1),
		neck: rotation(-1 - breath * 0.25, 5, 1),
		rightShoulder: rotation(12 + breath * 1.2, -5, 13),
		rightElbow: rotation(-28 - breath * 1.5, 0, 2),
		rightWrist: rotation(-5, 0, -4),
		leftShoulder: rotation(-5 - breath * 0.8, 3, -8),
		leftElbow: rotation(-10, 0, 0),
		rightHip: rotation(2, -4, 1),
		rightKnee: rotation(-5, 0, 0),
		leftHip: rotation(-2, -4, -1),
		leftKnee: rotation(-3, 0, 0),
	});
}

export function sampleHopliteSwordRun(phase: number, speedAlpha: number): SwordPose {
	const stride = math.sin(phase) * (24 + 12 * speedAlpha);
	const oppositeStride = -stride;
	const armCounter = math.sin(phase) * 7;
	const bob = math.abs(math.sin(phase)) * 0.055 * speedAlpha;
	const rightKneeBend = math.max(0, -stride) * 0.72;
	const leftKneeBend = math.max(0, stride) * 0.72;
	return pose({
		root: new CFrame(0, -bob, 0).mul(rotation(5 + speedAlpha * 3, 0, -math.sin(phase) * 1.5)),
		waist: rotation(-3, -math.sin(phase) * 4, math.sin(phase) * 1.5),
		neck: rotation(1, math.sin(phase) * 2, -math.sin(phase) * 0.8),
		rightShoulder: rotation(20 + armCounter, -5, 12),
		rightElbow: rotation(-34, 0, 2),
		rightWrist: rotation(-7, 0, -4),
		leftShoulder: rotation(oppositeStride * 0.55, 2, -8),
		leftElbow: rotation(-12 - math.max(0, stride) * 0.25, 0, 0),
		rightHip: rotation(stride, 0, 1),
		rightKnee: rotation(-rightKneeBend, 0, 0),
		rightAnkle: rotation(rightKneeBend * 0.25, 0, 0),
		leftHip: rotation(oppositeStride, 0, -1),
		leftKnee: rotation(-leftKneeBend, 0, 0),
		leftAnkle: rotation(leftKneeBend * 0.25, 0, 0),
	});
}
