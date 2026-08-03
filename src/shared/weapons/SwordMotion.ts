export const LIGHT_SWING_DURATION_SECONDS = 0.48;

// These timings keep the strike comfortably inside the 0.55 second action cooldown.
// They are also useful landmarks for adding damage and effects to the same motion later.
export const LIGHT_SWING_ANTICIPATION_SECONDS = 0.12;
export const LIGHT_SWING_STRIKE_SECONDS = 0.24;
export const LIGHT_SWING_FOLLOW_THROUGH_SECONDS = 0.35;

export interface SwordPose {
	readonly rightShoulder: CFrame;
	readonly waist: CFrame;
}

interface PoseKeyframe extends SwordPose {
	readonly time: number;
}

const LIGHT_SWING_KEYFRAMES: ReadonlyArray<PoseKeyframe> = [
	{
		time: 0,
		rightShoulder: CFrame.identity,
		waist: CFrame.identity,
	},
	{
		time: LIGHT_SWING_ANTICIPATION_SECONDS,
		// Raise the sword beside the right shoulder while winding the torso away.
		rightShoulder: CFrame.Angles(math.rad(-58), math.rad(18), math.rad(68)),
		waist: CFrame.Angles(math.rad(-4), math.rad(20), math.rad(-3)),
	},
	{
		time: LIGHT_SWING_STRIKE_SECONDS,
		// Drive a high-right to low-left diagonal cut with the torso leading the arm.
		rightShoulder: CFrame.Angles(math.rad(18), math.rad(-30), math.rad(-72)),
		waist: CFrame.Angles(math.rad(5), math.rad(-25), math.rad(5)),
	},
	{
		time: LIGHT_SWING_FOLLOW_THROUGH_SECONDS,
		// Carry momentum past the target instead of snapping directly back to neutral.
		rightShoulder: CFrame.Angles(math.rad(38), math.rad(-18), math.rad(-48)),
		waist: CFrame.Angles(math.rad(3), math.rad(-17), math.rad(3)),
	},
	{
		time: LIGHT_SWING_DURATION_SECONDS,
		rightShoulder: CFrame.identity,
		waist: CFrame.identity,
	},
];

function easeInOutCubic(alpha: number): number {
	return alpha < 0.5 ? 4 * alpha * alpha * alpha : 1 - math.pow(-2 * alpha + 2, 3) / 2;
}

export function sampleLightSwing(elapsedSeconds: number): SwordPose | undefined {
	if (elapsedSeconds < 0 || elapsedSeconds > LIGHT_SWING_DURATION_SECONDS) {
		return undefined;
	}

	for (let index = 0; index < LIGHT_SWING_KEYFRAMES.size() - 1; index++) {
		const from = LIGHT_SWING_KEYFRAMES[index];
		const to = LIGHT_SWING_KEYFRAMES[index + 1];
		if (elapsedSeconds <= to.time) {
			const duration = to.time - from.time;
			const alpha = duration > 0 ? (elapsedSeconds - from.time) / duration : 1;
			const easedAlpha = easeInOutCubic(math.clamp(alpha, 0, 1));
			return {
				rightShoulder: from.rightShoulder.Lerp(to.rightShoulder, easedAlpha),
				waist: from.waist.Lerp(to.waist, easedAlpha),
			};
		}
	}

	return undefined;
}
