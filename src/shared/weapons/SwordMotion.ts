import { LightComboStep } from "./LightCombo";

export const SWORD_POSE_JOINTS = [
	"root",
	"waist",
	"neck",
	"rightShoulder",
	"rightElbow",
	"leftShoulder",
	"leftElbow",
	"rightHip",
	"rightKnee",
	"leftHip",
	"leftKnee",
] as const;

export type SwordPoseJoint = (typeof SWORD_POSE_JOINTS)[number];
export type SwordPose = Readonly<Record<SwordPoseJoint, CFrame>>;

interface PoseKeyframe extends SwordPose {
	readonly time: number;
}

interface SwordMotionDefinition {
	readonly duration: number;
	readonly keyframes: ReadonlyArray<PoseKeyframe>;
}

const identityPose: SwordPose = {
	root: CFrame.identity,
	waist: CFrame.identity,
	neck: CFrame.identity,
	rightShoulder: CFrame.identity,
	rightElbow: CFrame.identity,
	leftShoulder: CFrame.identity,
	leftElbow: CFrame.identity,
	rightHip: CFrame.identity,
	rightKnee: CFrame.identity,
	leftHip: CFrame.identity,
	leftKnee: CFrame.identity,
};

function pose(time: number, overrides: Partial<SwordPose>): PoseKeyframe {
	return { time, ...identityPose, ...overrides };
}

function rotation(x: number, y: number, z: number): CFrame {
	return CFrame.Angles(math.rad(x), math.rad(y), math.rad(z));
}

const motions: Readonly<Record<LightComboStep, SwordMotionDefinition>> = {
	1: {
		duration: 0.56,
		keyframes: [
			pose(0, {}),
			pose(0.16, {
				root: rotation(0, 10, 0),
				waist: rotation(-7, 24, -5),
				neck: rotation(2, -10, 2),
				rightShoulder: rotation(-112, 12, 58),
				rightElbow: rotation(-42, 0, 8),
				leftShoulder: rotation(12, -12, -24),
				leftElbow: rotation(-18, 0, 0),
				rightHip: rotation(-8, -8, 3),
				leftHip: rotation(7, -6, -3),
			}),
			pose(0.33, {
				root: rotation(0, -13, 0),
				waist: rotation(9, -32, 8),
				neck: rotation(-3, 12, -3),
				rightShoulder: rotation(28, -34, -82),
				rightElbow: rotation(-5, 0, -6),
				leftShoulder: rotation(-12, 14, 28),
				rightHip: rotation(8, 8, -4),
				leftHip: rotation(-7, 6, 4),
			}),
			pose(0.45, {
				waist: rotation(7, -20, 5),
				rightShoulder: rotation(42, -22, -58),
				rightElbow: rotation(8, 0, -4),
				leftShoulder: rotation(-8, 9, 18),
			}),
			pose(0.56, {}),
		],
	},
	2: {
		duration: 0.56,
		keyframes: [
			pose(0, {}),
			pose(0.13, {
				root: rotation(0, -12, 0),
				waist: rotation(8, -28, 8),
				neck: rotation(-2, 10, -2),
				rightShoulder: rotation(38, -28, -76),
				rightElbow: rotation(-10, 0, -8),
				leftShoulder: rotation(-10, 12, 24),
				rightHip: rotation(7, 7, -3),
				leftHip: rotation(-7, 5, 3),
			}),
			pose(0.31, {
				root: rotation(0, 14, 0),
				waist: rotation(-9, 31, -8),
				neck: rotation(3, -12, 3),
				rightShoulder: rotation(-96, 22, 62),
				rightElbow: rotation(-24, 0, 6),
				leftShoulder: rotation(13, -13, -26),
				rightHip: rotation(-8, -8, 4),
				leftHip: rotation(7, -6, -4),
			}),
			pose(0.44, {
				waist: rotation(-5, 20, -5),
				rightShoulder: rotation(-76, 16, 42),
				rightElbow: rotation(-16, 0, 4),
				leftShoulder: rotation(8, -8, -17),
			}),
			pose(0.56, {}),
		],
	},
	3: {
		duration: 0.66,
		keyframes: [
			pose(0, {}),
			pose(0.18, {
				root: new CFrame(0, -0.08, 0.08).mul(rotation(0, 8, 0)),
				waist: rotation(-5, 14, 0),
				neck: rotation(3, -6, 0),
				rightShoulder: rotation(-45, 8, 32),
				rightElbow: rotation(-78, 0, 0),
				leftShoulder: rotation(-22, -8, -28),
				leftElbow: rotation(-42, 0, 0),
				rightHip: rotation(18, 0, 0),
				rightKnee: rotation(-22, 0, 0),
				leftHip: rotation(-14, 0, 0),
				leftKnee: rotation(-14, 0, 0),
			}),
			pose(0.38, {
				root: new CFrame(0, -0.04, -0.48),
				waist: rotation(-17, -5, 0),
				neck: rotation(8, 3, 0),
				rightShoulder: rotation(-92, 0, 8),
				rightElbow: rotation(-4, 0, 0),
				leftShoulder: rotation(18, 8, -24),
				leftElbow: rotation(-12, 0, 0),
				rightHip: rotation(-20, 0, 0),
				rightKnee: rotation(18, 0, 0),
				leftHip: rotation(17, 0, 0),
				leftKnee: rotation(-10, 0, 0),
			}),
			pose(0.53, {
				root: new CFrame(0, 0, -0.24),
				waist: rotation(-9, 0, 0),
				rightShoulder: rotation(-82, 0, 10),
				rightElbow: rotation(-8, 0, 0),
				leftShoulder: rotation(9, 4, -12),
			}),
			pose(0.66, {}),
		],
	},
	4: {
		duration: 0.88,
		keyframes: [
			pose(0, {}),
			pose(0.15, {
				root: rotation(0, 25, 0),
				waist: rotation(0, 28, 0),
				neck: rotation(0, -12, 0),
				rightShoulder: rotation(-28, 18, 72),
				rightElbow: rotation(-18, 0, 0),
				leftShoulder: rotation(8, -16, -62),
				leftElbow: rotation(-15, 0, 0),
				rightHip: rotation(-8, -12, 0),
				leftHip: rotation(8, -12, 0),
			}),
			pose(0.33, {
				root: rotation(0, 120, 0),
				waist: rotation(0, 18, 0),
				neck: rotation(0, -10, 0),
				rightShoulder: rotation(-10, 8, -78),
				rightElbow: rotation(-5, 0, 0),
				leftShoulder: rotation(5, -8, 68),
			}),
			pose(0.5, {
				root: rotation(0, 225, 0),
				waist: rotation(0, 14, 0),
				neck: rotation(0, -8, 0),
				rightShoulder: rotation(-6, -8, -88),
				leftShoulder: rotation(5, 8, 72),
			}),
			pose(0.67, {
				root: rotation(0, 320, 0),
				waist: rotation(0, 10, 0),
				neck: rotation(0, -5, 0),
				rightShoulder: rotation(8, -18, -72),
				leftShoulder: rotation(4, 15, 55),
			}),
			pose(0.77, {
				root: rotation(0, 359, 0),
				waist: rotation(0, -10, 0),
				rightShoulder: rotation(20, -25, -52),
				leftShoulder: rotation(-5, 10, 30),
			}),
			pose(0.88, {}),
		],
	},
};

function easeInOutCubic(alpha: number): number {
	return alpha < 0.5 ? 4 * alpha * alpha * alpha : 1 - math.pow(-2 * alpha + 2, 3) / 2;
}

export function getLightComboMotionDuration(step: LightComboStep): number {
	return motions[step].duration;
}

export function sampleLightComboMotion(step: LightComboStep, elapsedSeconds: number): SwordPose | undefined {
	const motion = motions[step];
	if (elapsedSeconds < 0 || elapsedSeconds > motion.duration) {
		return undefined;
	}

	for (let index = 0; index < motion.keyframes.size() - 1; index++) {
		const from = motion.keyframes[index];
		const to = motion.keyframes[index + 1];
		if (elapsedSeconds <= to.time) {
			const duration = to.time - from.time;
			const alpha = duration > 0 ? (elapsedSeconds - from.time) / duration : 1;
			const easedAlpha = easeInOutCubic(math.clamp(alpha, 0, 1));
			const result = {} as Record<SwordPoseJoint, CFrame>;
			for (const joint of SWORD_POSE_JOINTS) {
				result[joint] = from[joint].Lerp(to[joint], easedAlpha);
			}
			return result;
		}
	}
	return undefined;
}
