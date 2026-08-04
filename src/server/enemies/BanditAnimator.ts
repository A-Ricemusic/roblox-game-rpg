import { BANDIT_ANIMATION_IDS, REALISTIC_PIRATE_ANIMATION_IDS } from "./BanditConstants";

type LocomotionState = "idle" | "run";

function loadTrack(
	animator: Animator,
	animationId: string,
	priority: Enum.AnimationPriority,
	looped: boolean,
): AnimationTrack {
	const animation = new Instance("Animation");
	animation.AnimationId = animationId;
	const track = animator.LoadAnimation(animation);
	track.Priority = priority;
	track.Looped = looped;
	animation.Destroy();
	return track;
}

export class BanditAnimator {
	private readonly idle: AnimationTrack;
	private readonly run: AnimationTrack;
	private readonly attack: AnimationTrack;
	private locomotion: LocomotionState = "idle";
	private attackEndsAt = 0;

	public constructor(model: Model) {
		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid === undefined) error(`${model.GetFullName()} is missing its Humanoid.`);
		let animator = humanoid.FindFirstChildOfClass("Animator");
		if (animator === undefined) {
			animator = new Instance("Animator");
			animator.Parent = humanoid;
		}
		const realistic = model.GetAttribute("RealisticPirate") === true;
		const archetype = model.GetAttribute("BanditArchetype");
		this.idle = loadTrack(
			animator,
			realistic ? REALISTIC_PIRATE_ANIMATION_IDS.idle : BANDIT_ANIMATION_IDS.idle,
			Enum.AnimationPriority.Idle,
			true,
		);
		this.run = loadTrack(
			animator,
			realistic ? REALISTIC_PIRATE_ANIMATION_IDS.run : BANDIT_ANIMATION_IDS.run,
			Enum.AnimationPriority.Movement,
			true,
		);
		const attackId = realistic
			? archetype === "Ranged"
				? REALISTIC_PIRATE_ANIMATION_IDS.rangedAttack
				: REALISTIC_PIRATE_ANIMATION_IDS.meleeAttack
			: BANDIT_ANIMATION_IDS.attack;
		this.attack = loadTrack(animator, attackId, Enum.AnimationPriority.Action, false);
		this.idle.Play(0.15);
	}

	public beginAttack(now: number): void {
		this.attackEndsAt = now + 0.72;
		this.idle.Stop(0.08);
		this.run.Stop(0.08);
		this.attack.Stop(0);
		this.attack.Play(0.05, 1, 1);
	}

	public update(_deltaTime: number, now: number, moving: boolean): void {
		if (now < this.attackEndsAt) return;
		const desired: LocomotionState = moving ? "run" : "idle";
		if (desired === this.locomotion && (desired === "run" ? this.run.IsPlaying : this.idle.IsPlaying)) return;
		this.locomotion = desired;
		if (desired === "run") {
			this.idle.Stop(0.15);
			if (!this.run.IsPlaying) this.run.Play(0.15);
		} else {
			this.run.Stop(0.15);
			if (!this.idle.IsPlaying) this.idle.Play(0.15);
		}
	}

	public reset(): void {
		this.idle.Stop(0);
		this.run.Stop(0);
		this.attack.Stop(0);
		this.idle.Destroy();
		this.run.Destroy();
		this.attack.Destroy();
	}
}
