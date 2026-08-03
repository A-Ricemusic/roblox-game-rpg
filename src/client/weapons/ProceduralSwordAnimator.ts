import { RunService, Workspace } from "@rbxts/services";
import { LIGHT_SWING_DURATION_SECONDS, sampleLightSwing } from "shared/weapons/SwordMotion";

interface JointPoseDriver {
	readonly apply: (transform: CFrame) => void;
	readonly reset: () => void;
}

interface ActiveSwing {
	readonly startedAt: number;
	readonly rightShoulder: JointPoseDriver;
	readonly waist?: JointPoseDriver;
}

function createPoseDriver(candidate: Instance): JointPoseDriver | undefined {
	if (candidate.IsA("AnimationConstraint")) {
		return {
			apply: (transform) => (candidate.Transform = transform),
			reset: () => (candidate.Transform = CFrame.identity),
		};
	}

	if (candidate.IsA("Motor6D")) {
		return {
			apply: (transform) => (candidate.Transform = transform),
			reset: () => (candidate.Transform = CFrame.identity),
		};
	}

	if (candidate.IsA("Bone")) {
		return {
			apply: (transform) => (candidate.Transform = transform),
			reset: () => (candidate.Transform = CFrame.identity),
		};
	}

	if (candidate.IsA("Weld") || candidate.IsA("ManualWeld")) {
		const baseC0 = candidate.C0;
		return {
			apply: (transform) => (candidate.C0 = baseC0.mul(transform)),
			reset: () => (candidate.C0 = baseC0),
		};
	}

	return undefined;
}

function findNamedPoseDriver(
	character: Model,
	preferredParentName: string,
	jointNames: ReadonlySet<string>,
	connectedPartNames: ReadonlySet<string>,
): JointPoseDriver | undefined {
	const preferredParent = character.FindFirstChild(preferredParentName);
	if (preferredParent !== undefined) {
		for (const jointName of jointNames) {
			const candidate = preferredParent.FindFirstChild(jointName);
			if (candidate !== undefined) {
				const driver = createPoseDriver(candidate);
				if (driver !== undefined) {
					return driver;
				}
			}
		}
	}

	for (const descendant of character.GetDescendants()) {
		if (jointNames.has(descendant.Name)) {
			const driver = createPoseDriver(descendant);
			if (driver !== undefined) {
				return driver;
			}
		}

		if (descendant.IsA("Motor6D")) {
			const connectedPartName = descendant.Part1?.Name;
			if (connectedPartName !== undefined && connectedPartNames.has(connectedPartName)) {
				return createPoseDriver(descendant);
			}
		}
	}
	return undefined;
}

const RIGHT_SHOULDER_NAMES = new Set(["RightShoulder", "Right Shoulder"]);
const RIGHT_ARM_PART_NAMES = new Set(["RightUpperArm", "Right Arm"]);
const WAIST_NAMES = new Set(["Waist"]);
const UPPER_TORSO_PART_NAMES = new Set(["UpperTorso", "Torso"]);

function resetSwing(swing: ActiveSwing): void {
	swing.rightShoulder.reset();
	swing.waist?.reset();
}

export class ProceduralSwordAnimator {
	private readonly activeSwings = new Map<Model, ActiveSwing>();
	private readonly frameConnection: RBXScriptConnection;
	private destroyed = false;

	public constructor() {
		this.frameConnection = RunService.PreSimulation.Connect(() => this.update());
	}

	public playLightSwing(character: Model, startedAt: number): boolean {
		if (this.destroyed) {
			return false;
		}

		const rightShoulder = findNamedPoseDriver(
			character,
			"RightUpperArm",
			RIGHT_SHOULDER_NAMES,
			RIGHT_ARM_PART_NAMES,
		);
		if (rightShoulder === undefined) {
			warn(`[WeaponAnimator] ${character.GetFullName()} has no supported right-shoulder joint.`);
			return false;
		}

		const waist = findNamedPoseDriver(character, "LowerTorso", WAIST_NAMES, UPPER_TORSO_PART_NAMES);
		const existingSwing = this.activeSwings.get(character);
		if (existingSwing !== undefined) {
			resetSwing(existingSwing);
		}
		this.activeSwings.set(character, { startedAt, rightShoulder, waist });
		return true;
	}

	public destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		this.frameConnection.Disconnect();
		for (const [, swing] of this.activeSwings) {
			resetSwing(swing);
		}
		this.activeSwings.clear();
	}

	private update(): void {
		const now = Workspace.GetServerTimeNow();
		for (const [character, swing] of this.activeSwings) {
			if (character.Parent === undefined) {
				resetSwing(swing);
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

			swing.rightShoulder.apply(pose.rightShoulder);
			swing.waist?.apply(pose.waist);
		}
	}
}
