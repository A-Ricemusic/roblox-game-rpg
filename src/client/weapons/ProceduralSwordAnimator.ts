import { RunService, Workspace } from "@rbxts/services";
import { LIGHT_SWING_DURATION_SECONDS, sampleLightSwing } from "shared/weapons/SwordMotion";

const RENDER_STEP_NAME = "ProceduralSwordAnimator";

interface ActiveSwing {
	readonly startedAt: number;
	readonly rightShoulder: Motor6D;
	readonly waist?: Motor6D;
}

function findMotor(character: Model, parentName: string, motorName: string): Motor6D | undefined {
	const parent = character.FindFirstChild(parentName);
	const motor = parent?.FindFirstChild(motorName);
	return motor?.IsA("Motor6D") === true ? motor : undefined;
}

function resetSwing(swing: ActiveSwing): void {
	swing.rightShoulder.Transform = CFrame.identity;
	if (swing.waist !== undefined) {
		swing.waist.Transform = CFrame.identity;
	}
}

export class ProceduralSwordAnimator {
	private readonly activeSwings = new Map<Model, ActiveSwing>();
	private destroyed = false;

	public constructor() {
		RunService.BindToRenderStep(RENDER_STEP_NAME, Enum.RenderPriority.Character.Value + 1, () => this.update());
	}

	public playLightSwing(character: Model, startedAt: number): boolean {
		if (this.destroyed) {
			return false;
		}

		const rightShoulder = findMotor(character, "UpperTorso", "RightShoulder");
		if (rightShoulder === undefined) {
			warn(
				`[WeaponAnimator] ${character.GetFullName()} is missing UpperTorso.RightShoulder; cannot animate sword.`,
			);
			return false;
		}

		const waist = findMotor(character, "LowerTorso", "Waist");
		this.activeSwings.set(character, { startedAt, rightShoulder, waist });
		return true;
	}

	public destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		RunService.UnbindFromRenderStep(RENDER_STEP_NAME);
		for (const [, swing] of this.activeSwings) {
			resetSwing(swing);
		}
		this.activeSwings.clear();
	}

	private update(): void {
		const now = Workspace.GetServerTimeNow();
		for (const [character, swing] of this.activeSwings) {
			if (character.Parent === undefined) {
				this.activeSwings.delete(character);
				continue;
			}

			const elapsed = math.max(0, now - swing.startedAt);
			const pose = sampleLightSwing(elapsed);
			if (pose === undefined || elapsed >= LIGHT_SWING_DURATION_SECONDS) {
				resetSwing(swing);
				this.activeSwings.delete(character);
				continue;
			}

			swing.rightShoulder.Transform = pose.rightShoulder;
			if (swing.waist !== undefined) {
				swing.waist.Transform = pose.waist;
			}
		}
	}
}
