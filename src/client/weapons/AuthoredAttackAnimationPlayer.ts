import { Workspace } from "@rbxts/services";

import { HOPLITE_SWORD_ATTACK_ANIMATIONS } from "shared/weapons/HopliteSwordAnimations";
import { LightComboStep } from "shared/weapons/LightCombo";
import { EQUIPPED_WEAPON_NAME } from "shared/weapons/WeaponConstants";

const TRACK_REPLACEMENT_FADE_SECONDS = 0.06;

interface ActiveTrack {
	readonly track: AnimationTrack;
	readonly stoppedConnection: RBXScriptConnection;
	readonly equippedConnection: RBXScriptConnection;
}

export class AuthoredAttackAnimationPlayer {
	private readonly activeByCharacter = new Map<Model, ActiveTrack>();

	public play(character: Model | undefined, step: LightComboStep, startedAt?: number): boolean {
		if (character === undefined) return false;
		const equippedWeapon = character.FindFirstChild(EQUIPPED_WEAPON_NAME);
		if (equippedWeapon === undefined) return false;
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		const animator = humanoid?.FindFirstChildOfClass("Animator");
		if (humanoid === undefined || humanoid.Health <= 0 || animator === undefined) return false;

		const definition = HOPLITE_SWORD_ATTACK_ANIMATIONS[step];
		const elapsed = startedAt === undefined ? 0 : math.max(0, Workspace.GetServerTimeNow() - startedAt);
		if (elapsed >= definition.durationSeconds) return false;

		this.stopCharacter(character);
		const animation = new Instance("Animation");
		animation.Name = definition.name;
		animation.AnimationId = definition.animationId;
		const track = animator.LoadAnimation(animation);
		animation.Destroy();
		track.Priority = Enum.AnimationPriority.Action;
		track.Looped = false;
		track.Play(TRACK_REPLACEMENT_FADE_SECONDS, 1, definition.playbackSpeed);
		if (elapsed > 0) track.TimePosition = elapsed * definition.playbackSpeed;

		const equippedConnection = equippedWeapon.AncestryChanged.Connect(() => {
			if (equippedWeapon.Parent !== character) this.stopCharacter(character);
		});
		const stoppedConnection = track.Stopped.Connect(() => {
			const active = this.activeByCharacter.get(character);
			if (active?.track === track) this.activeByCharacter.delete(character);
			stoppedConnection.Disconnect();
			equippedConnection.Disconnect();
			track.Destroy();
		});
		this.activeByCharacter.set(character, { track, stoppedConnection, equippedConnection });
		return true;
	}

	public stopCharacter(character: Model): void {
		const active = this.activeByCharacter.get(character);
		if (active === undefined) return;
		this.activeByCharacter.delete(character);
		active.equippedConnection.Disconnect();
		active.track.Stop(TRACK_REPLACEMENT_FADE_SECONDS);
	}

	public stopAll(): void {
		for (const [character] of this.activeByCharacter) this.stopCharacter(character);
	}
}
