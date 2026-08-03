import { LightComboStep } from "./LightCombo";

export const SWORD_POSE_JOINTS = [
	"root",
	"waist",
	"neck",
	"rightShoulder",
	"rightElbow",
	"rightWrist",
	"leftShoulder",
	"leftElbow",
	"leftWrist",
	"rightHip",
	"rightKnee",
	"rightAnkle",
	"leftHip",
	"leftKnee",
	"leftAnkle",
] as const;

export type SwordPoseJoint = (typeof SWORD_POSE_JOINTS)[number];
export type SwordPose = Readonly<Record<SwordPoseJoint, CFrame>>;

type PoseEasing = "Smooth" | "EaseIn" | "EaseOut" | "Linear";

interface PoseKeyframe extends SwordPose {
	readonly time: number;
	readonly easing: PoseEasing;
}

interface SwordMotionDefinition {
	readonly duration: number;
	readonly activeWindow: readonly [startSeconds: number, endSeconds: number];
	readonly keyframes: ReadonlyArray<PoseKeyframe>;
}

const identityPose: SwordPose = {
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
};

function pose(time: number, overrides: Partial<SwordPose>, easing: PoseEasing = "Smooth"): PoseKeyframe {
	return { time, easing, ...identityPose, ...overrides };
}

function rotation(x: number, y: number, z: number): CFrame {
	return CFrame.Angles(math.rad(x), math.rad(y), math.rad(z));
}

const motions: Readonly<Record<LightComboStep, SwordMotionDefinition>> = {
	1: {
		duration: 0.62,
		activeWindow: [0.18, 0.47],
		keyframes: [
			pose(0, {}),
			pose(0.08, {
				root: rotation(0, -5, 0),
				waist: rotation(1, -8, 0),
				rightShoulder: rotation(18, 2, 10),
				leftShoulder: rotation(8, 0, -8),
			}),
			pose(0.2, {
				root: rotation(0, 16, 0),
				waist: rotation(-8, 30, -7),
				neck: rotation(2, -12, 3),
				rightShoulder: rotation(108, 4, -38),
				rightElbow: rotation(-34, 0, 4),
				rightWrist: rotation(8, -4, 16),
				leftShoulder: rotation(18, -8, -22),
				leftElbow: rotation(-22, 0, 0),
				rightHip: rotation(-8, -8, 2),
				leftHip: rotation(8, -6, -2),
			}),
			pose(
				0.29,
				{
					root: rotation(0, 2, 0),
					waist: rotation(-2, 8, -2),
					neck: rotation(1, -3, 1),
					rightShoulder: rotation(58, -10, 8),
					rightElbow: rotation(-14, 0, 0),
					rightWrist: rotation(2, -2, 4),
					leftShoulder: rotation(4, -2, -8),
					rightHip: rotation(-2, -2, 0),
					leftHip: rotation(2, -2, 0),
				},
				"EaseIn",
			),
			pose(
				0.37,
				{
					root: rotation(0, -17, 0),
					waist: rotation(10, -34, 8),
					neck: rotation(-3, 13, -3),
					rightShoulder: rotation(-8, -28, 36),
					rightElbow: rotation(2, 0, -2),
					rightWrist: rotation(-8, 4, -12),
					leftShoulder: rotation(-14, 12, 24),
					leftElbow: rotation(-10, 0, 0),
					rightHip: rotation(9, 8, -3),
					leftHip: rotation(-8, 6, 3),
				},
				"Linear",
			),
			pose(
				0.47,
				{
					root: rotation(0, -20, 0),
					waist: rotation(8, -28, 7),
					neck: rotation(-2, 10, -2),
					rightShoulder: rotation(-38, -30, 55),
					rightElbow: rotation(6, 0, -3),
					rightWrist: rotation(-12, 5, -18),
					leftShoulder: rotation(-10, 9, 18),
					rightHip: rotation(8, 7, -3),
					leftHip: rotation(-7, 5, 3),
				},
				"EaseOut",
			),
			pose(0.62, {}),
		],
	},
	2: {
		duration: 0.62,
		activeWindow: [0.14, 0.43],
		keyframes: [
			pose(0, {}),
			pose(0.14, {
				root: rotation(0, -18, 0),
				waist: rotation(9, -30, 8),
				neck: rotation(-2, 11, -2),
				rightShoulder: rotation(-36, -28, 55),
				rightElbow: rotation(-8, 0, -3),
				rightWrist: rotation(-12, 4, -18),
				leftShoulder: rotation(-12, 10, 22),
				rightHip: rotation(8, 7, -3),
				leftHip: rotation(-8, 5, 3),
			}),
			pose(
				0.23,
				{
					root: rotation(0, -4, 0),
					waist: rotation(3, -10, 3),
					rightShoulder: rotation(0, -18, 30),
					rightElbow: rotation(-4, 0, 0),
					rightWrist: rotation(-5, 2, -8),
					leftShoulder: rotation(-4, 4, 8),
				},
				"EaseIn",
			),
			pose(
				0.31,
				{
					root: rotation(0, 14, 0),
					waist: rotation(-7, 27, -7),
					neck: rotation(2, -10, 2),
					rightShoulder: rotation(62, 6, -8),
					rightElbow: rotation(-12, 0, 2),
					rightWrist: rotation(4, -3, 6),
					leftShoulder: rotation(12, -10, -20),
					rightHip: rotation(-7, -7, 3),
					leftHip: rotation(7, -5, -3),
				},
				"Linear",
			),
			pose(
				0.43,
				{
					root: rotation(0, 18, 0),
					waist: rotation(-9, 32, -8),
					neck: rotation(3, -12, 3),
					rightShoulder: rotation(104, 16, -42),
					rightElbow: rotation(-24, 0, 5),
					rightWrist: rotation(10, -5, 14),
					leftShoulder: rotation(15, -13, -25),
					rightHip: rotation(-9, -8, 4),
					leftHip: rotation(8, -6, -4),
				},
				"EaseOut",
			),
			pose(0.62, {}),
		],
	},
	3: {
		duration: 0.7,
		activeWindow: [0.2, 0.51],
		keyframes: [
			pose(0, {}),
			pose(0.2, {
				root: new CFrame(0, -0.1, 0.1).mul(rotation(0, 4, 0)),
				waist: rotation(4, 10, 0),
				neck: rotation(-2, -4, 0),
				rightShoulder: rotation(38, 6, 20),
				rightElbow: rotation(-92, 0, 0),
				rightWrist: rotation(42, 0, -8),
				leftShoulder: rotation(-24, -8, -22),
				leftElbow: rotation(-48, 0, 0),
				rightHip: rotation(20, 0, 0),
				rightKnee: rotation(-26, 0, 0),
				leftHip: rotation(-16, 0, 0),
				leftKnee: rotation(-12, 0, 0),
			}),
			pose(
				0.29,
				{
					root: new CFrame(0, -0.08, -0.12),
					waist: rotation(-6, 3, 0),
					neck: rotation(3, -2, 0),
					rightShoulder: rotation(66, 2, 10),
					rightElbow: rotation(-44, 0, 0),
					rightWrist: rotation(68, 0, -3),
					leftShoulder: rotation(-8, -2, -14),
					rightHip: rotation(4, 0, 0),
					leftHip: rotation(-3, 0, 0),
				},
				"EaseIn",
			),
			pose(
				0.38,
				{
					root: new CFrame(0, -0.04, -0.62),
					waist: rotation(-18, -4, 0),
					neck: rotation(8, 2, 0),
					rightShoulder: rotation(98, -2, 4),
					rightElbow: rotation(-2, 0, 0),
					rightWrist: rotation(90, 0, 0),
					leftShoulder: rotation(22, 6, -18),
					leftElbow: rotation(-10, 0, 0),
					rightHip: rotation(-24, 0, 0),
					rightKnee: rotation(20, 0, 0),
					rightAnkle: rotation(8, 0, 0),
					leftHip: rotation(20, 0, 0),
					leftKnee: rotation(-12, 0, 0),
					leftAnkle: rotation(-5, 0, 0),
				},
				"Linear",
			),
			pose(
				0.51,
				{
					root: new CFrame(0, -0.02, -0.48),
					waist: rotation(-13, -2, 0),
					neck: rotation(6, 1, 0),
					rightShoulder: rotation(92, -1, 5),
					rightElbow: rotation(-5, 0, 0),
					rightWrist: rotation(84, 0, 0),
					leftShoulder: rotation(16, 4, -14),
					rightHip: rotation(-16, 0, 0),
					leftHip: rotation(14, 0, 0),
				},
				"EaseOut",
			),
			pose(0.7, {}),
		],
	},
	4: {
		duration: 0.94,
		activeWindow: [0.16, 0.8],
		keyframes: [
			pose(0, {}),
			pose(0.16, {
				root: rotation(0, -28, 0),
				waist: rotation(0, -24, 0),
				neck: rotation(0, 12, 0),
				rightShoulder: rotation(-8, 10, -88),
				rightElbow: rotation(-6, 0, 0),
				rightWrist: rotation(90, 12, 0),
				leftShoulder: rotation(6, -10, 58),
				leftElbow: rotation(-18, 0, 0),
				rightHip: rotation(-8, 12, 0),
				leftHip: rotation(8, 12, 0),
			}),
			pose(
				0.3,
				{
					root: rotation(0, 70, 0),
					waist: rotation(0, 18, 0),
					neck: rotation(0, -10, 0),
					rightShoulder: rotation(-6, 5, -94),
					rightElbow: rotation(0, 0, 0),
					rightWrist: rotation(90, 8, 0),
					leftShoulder: rotation(5, -8, 66),
					leftElbow: rotation(-8, 0, 0),
					rightHip: rotation(-10, -8, 0),
					leftHip: rotation(10, -8, 0),
				},
				"EaseIn",
			),
			pose(
				0.44,
				{
					root: rotation(0, 160, 0),
					waist: rotation(0, 14, 0),
					neck: rotation(0, -8, 0),
					rightShoulder: rotation(-5, 0, -96),
					rightElbow: rotation(2, 0, 0),
					rightWrist: rotation(90, 4, 0),
					leftShoulder: rotation(4, 0, 68),
					leftElbow: rotation(-5, 0, 0),
				},
				"Linear",
			),
			pose(
				0.58,
				{
					root: rotation(0, 250, 0),
					waist: rotation(0, 12, 0),
					neck: rotation(0, -7, 0),
					rightShoulder: rotation(-4, -5, -96),
					rightElbow: rotation(2, 0, 0),
					rightWrist: rotation(90, -4, 0),
					leftShoulder: rotation(4, 5, 68),
					leftElbow: rotation(-5, 0, 0),
				},
				"Linear",
			),
			pose(
				0.72,
				{
					root: rotation(0, 340, 0),
					waist: rotation(0, 8, 0),
					neck: rotation(0, -4, 0),
					rightShoulder: rotation(-2, -8, -92),
					rightElbow: rotation(0, 0, 0),
					rightWrist: rotation(90, -8, 0),
					leftShoulder: rotation(3, 8, 64),
					leftElbow: rotation(-6, 0, 0),
				},
				"Linear",
			),
			pose(
				0.8,
				{
					root: rotation(0, 359, 0),
					waist: rotation(0, -8, 0),
					neck: rotation(0, 4, 0),
					rightShoulder: rotation(10, -12, -76),
					rightElbow: rotation(-8, 0, 0),
					rightWrist: rotation(72, -10, 0),
					leftShoulder: rotation(-2, 7, 48),
				},
				"EaseOut",
			),
			pose(0.94, {}),
		],
	},
};

function ease(alpha: number, style: PoseEasing): number {
	if (style === "Linear") return alpha;
	if (style === "EaseIn") return alpha * alpha;
	if (style === "EaseOut") return 1 - (1 - alpha) * (1 - alpha);
	return alpha < 0.5 ? 4 * alpha * alpha * alpha : 1 - math.pow(-2 * alpha + 2, 3) / 2;
}

export function getLightComboMotionDuration(step: LightComboStep): number {
	return motions[step].duration;
}

export function getLightComboActiveWindow(step: LightComboStep): readonly [startSeconds: number, endSeconds: number] {
	return motions[step].activeWindow;
}

export function sampleLightComboMotion(step: LightComboStep, elapsedSeconds: number): SwordPose | undefined {
	const motion = motions[step];
	if (elapsedSeconds < 0 || elapsedSeconds > motion.duration) return undefined;

	for (let index = 0; index < motion.keyframes.size() - 1; index++) {
		const from = motion.keyframes[index];
		const to = motion.keyframes[index + 1];
		if (elapsedSeconds <= to.time) {
			const duration = to.time - from.time;
			const alpha = duration > 0 ? (elapsedSeconds - from.time) / duration : 1;
			const easedAlpha = ease(math.clamp(alpha, 0, 1), to.easing);
			const result = {} as Record<SwordPoseJoint, CFrame>;
			for (const joint of SWORD_POSE_JOINTS) result[joint] = from[joint].Lerp(to[joint], easedAlpha);
			return result;
		}
	}
	return undefined;
}
