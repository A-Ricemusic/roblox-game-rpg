import { RunService, Workspace } from "@rbxts/services";
import { LIGHT_SWING_DURATION_SECONDS, sampleLightSwing } from "shared/weapons/SwordMotion";

interface ActiveSwing {
	readonly startedAt: number;
}

interface AppliedPose {
	readonly rightShoulder?: CFrame;
	readonly waist?: CFrame;
}

function findMotor(character: Model, parentName: string, motorName: string): Motor6D | undefined {
	const parent = character.FindFirstChild(parentName);
	const motor = parent?.FindFirstChild(motorName);
	return motor?.IsA("Motor6D") === true ? motor : undefined;
}

export class ProceduralSwordAnimator {
	private readonly activeSwings = new Map<Model, ActiveSwing>();
	private readonly appliedPoses = new Map<Model, AppliedPose>();
	private readonly animationConnection: RBXScriptConnection;
	private readonly frameConnection: RBXScriptConnection;

	public constructor() {
		this.animationConnection = RunService.PreAnimation.Connect(() => this.removeAppliedPoses());
		this.frameConnection = RunService.PreSimulation.Connect(() => this.update());
	}

	public playLightSwing(character: Model, startedAt: number): void {
		this.activeSwings.set(character, { startedAt });
	}

	public destroy(): void {
		this.removeAppliedPoses();
		this.animationConnection.Disconnect();
		this.frameConnection.Disconnect();
		this.activeSwings.clear();
		this.appliedPoses.clear();
	}

	private removeAppliedPoses(): void {
		for (const [character, pose] of this.appliedPoses) {
			const rightShoulder = findMotor(character, "UpperTorso", "RightShoulder");
			const waist = findMotor(character, "LowerTorso", "Waist");
			if (rightShoulder !== undefined && pose.rightShoulder !== undefined) {
				rightShoulder.Transform = rightShoulder.Transform.mul(pose.rightShoulder.Inverse());
			}
			if (waist !== undefined && pose.waist !== undefined) {
				waist.Transform = waist.Transform.mul(pose.waist.Inverse());
			}
		}
		this.appliedPoses.clear();
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
				this.activeSwings.delete(character);
				continue;
			}

			const rightShoulder = findMotor(character, "UpperTorso", "RightShoulder");
			const waist = findMotor(character, "LowerTorso", "Waist");
			if (rightShoulder !== undefined) {
				rightShoulder.Transform = rightShoulder.Transform.mul(pose.rightShoulder);
			}
			if (waist !== undefined) {
				waist.Transform = waist.Transform.mul(pose.waist);
			}
			this.appliedPoses.set(character, {
				rightShoulder: rightShoulder !== undefined ? pose.rightShoulder : undefined,
				waist: waist !== undefined ? pose.waist : undefined,
			});
		}
	}
}
