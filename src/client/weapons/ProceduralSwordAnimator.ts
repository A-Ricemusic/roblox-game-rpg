import { RunService, Workspace } from "@rbxts/services";
import { LightComboStep } from "shared/weapons/LightCombo";
import { getLightComboMotionDuration, sampleLightComboMotion, SwordPoseJoint } from "shared/weapons/SwordMotion";

interface JointPoseDriver {
	readonly apply: (transform: CFrame) => void;
	readonly reset: () => void;
}

interface JointSpec {
	readonly poseJoint: SwordPoseJoint;
	readonly preferredParentName: string;
	readonly jointNames: ReadonlySet<string>;
	readonly connectedPartNames: ReadonlySet<string>;
}

interface ActiveSwing {
	readonly startedAt: number;
	readonly comboStep: LightComboStep;
	readonly drivers: ReadonlyMap<SwordPoseJoint, JointPoseDriver>;
	readonly previewElapsed?: number;
}

const JOINT_SPECS: ReadonlyArray<JointSpec> = [
	{
		poseJoint: "root",
		preferredParentName: "LowerTorso",
		jointNames: new Set(["Root", "RootJoint"]),
		connectedPartNames: new Set(["LowerTorso", "Torso"]),
	},
	{
		poseJoint: "waist",
		preferredParentName: "UpperTorso",
		jointNames: new Set(["Waist"]),
		connectedPartNames: new Set(["UpperTorso", "Torso"]),
	},
	{
		poseJoint: "neck",
		preferredParentName: "Head",
		jointNames: new Set(["Neck"]),
		connectedPartNames: new Set(["Head"]),
	},
	{
		poseJoint: "rightShoulder",
		preferredParentName: "RightUpperArm",
		jointNames: new Set(["RightShoulder", "Right Shoulder"]),
		connectedPartNames: new Set(["RightUpperArm", "Right Arm"]),
	},
	{
		poseJoint: "rightElbow",
		preferredParentName: "RightLowerArm",
		jointNames: new Set(["RightElbow", "Right Elbow"]),
		connectedPartNames: new Set(["RightLowerArm"]),
	},
	{
		poseJoint: "leftShoulder",
		preferredParentName: "LeftUpperArm",
		jointNames: new Set(["LeftShoulder", "Left Shoulder"]),
		connectedPartNames: new Set(["LeftUpperArm", "Left Arm"]),
	},
	{
		poseJoint: "leftElbow",
		preferredParentName: "LeftLowerArm",
		jointNames: new Set(["LeftElbow", "Left Elbow"]),
		connectedPartNames: new Set(["LeftLowerArm"]),
	},
	{
		poseJoint: "rightHip",
		preferredParentName: "RightUpperLeg",
		jointNames: new Set(["RightHip", "Right Hip"]),
		connectedPartNames: new Set(["RightUpperLeg", "Right Leg"]),
	},
	{
		poseJoint: "rightKnee",
		preferredParentName: "RightLowerLeg",
		jointNames: new Set(["RightKnee", "Right Knee"]),
		connectedPartNames: new Set(["RightLowerLeg"]),
	},
	{
		poseJoint: "leftHip",
		preferredParentName: "LeftUpperLeg",
		jointNames: new Set(["LeftHip", "Left Hip"]),
		connectedPartNames: new Set(["LeftUpperLeg", "Left Leg"]),
	},
	{
		poseJoint: "leftKnee",
		preferredParentName: "LeftLowerLeg",
		jointNames: new Set(["LeftKnee", "Left Knee"]),
		connectedPartNames: new Set(["LeftLowerLeg"]),
	},
];

function createPoseDriver(candidate: Instance): JointPoseDriver | undefined {
	if (candidate.IsA("AnimationConstraint") || candidate.IsA("Motor6D")) {
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

function findPoseDriver(character: Model, spec: JointSpec): JointPoseDriver | undefined {
	const preferredParent = character.FindFirstChild(spec.preferredParentName);
	if (preferredParent !== undefined) {
		for (const jointName of spec.jointNames) {
			const candidate = preferredParent.FindFirstChild(jointName);
			if (candidate !== undefined) {
				const driver = createPoseDriver(candidate);
				if (driver !== undefined) return driver;
			}
		}
	}

	for (const descendant of character.GetDescendants()) {
		if (spec.jointNames.has(descendant.Name)) {
			const driver = createPoseDriver(descendant);
			if (driver !== undefined) return driver;
		}

		if (descendant.IsA("Motor6D")) {
			const connectedPartName = descendant.Part1?.Name;
			if (connectedPartName !== undefined && spec.connectedPartNames.has(connectedPartName)) {
				return createPoseDriver(descendant);
			}
		}
	}
	return undefined;
}

function resolvePoseDrivers(character: Model): Map<SwordPoseJoint, JointPoseDriver> {
	const drivers = new Map<SwordPoseJoint, JointPoseDriver>();
	for (const spec of JOINT_SPECS) {
		const driver = findPoseDriver(character, spec);
		if (driver !== undefined) drivers.set(spec.poseJoint, driver);
	}
	return drivers;
}

function resetSwing(swing: ActiveSwing): void {
	for (const [, driver] of swing.drivers) driver.reset();
}

export class ProceduralSwordAnimator {
	private readonly activeSwings = new Map<Model, ActiveSwing>();
	private readonly frameConnection: RBXScriptConnection;
	private destroyed = false;

	public constructor() {
		this.frameConnection = RunService.PreSimulation.Connect(() => this.update());
	}

	public playLightSwing(character: Model, startedAt: number, comboStep: LightComboStep): boolean {
		if (this.destroyed) return false;

		const drivers = resolvePoseDrivers(character);
		if (!drivers.has("rightShoulder")) {
			warn(`[WeaponAnimator] ${character.GetFullName()} has no supported right-shoulder joint.`);
			return false;
		}

		const existingSwing = this.activeSwings.get(character);
		if (existingSwing !== undefined) resetSwing(existingSwing);
		this.activeSwings.set(character, { startedAt, comboStep, drivers });
		return true;
	}

	public previewLightSwing(character: Model, comboStep: LightComboStep, elapsedSeconds: number): boolean {
		if (this.destroyed) return false;

		const drivers = resolvePoseDrivers(character);
		if (!drivers.has("rightShoulder")) return false;

		const existingSwing = this.activeSwings.get(character);
		if (existingSwing !== undefined) resetSwing(existingSwing);
		this.activeSwings.set(character, {
			startedAt: 0,
			comboStep,
			drivers,
			previewElapsed: math.clamp(elapsedSeconds, 0, getLightComboMotionDuration(comboStep)),
		});
		return true;
	}

	public clearCharacter(character: Model): void {
		const swing = this.activeSwings.get(character);
		if (swing === undefined) return;
		resetSwing(swing);
		this.activeSwings.delete(character);
	}

	public destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.frameConnection.Disconnect();
		for (const [, swing] of this.activeSwings) resetSwing(swing);
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

			const elapsed = swing.previewElapsed ?? math.max(0, now - swing.startedAt);
			const pose = sampleLightComboMotion(swing.comboStep, elapsed);
			if (
				pose === undefined ||
				(swing.previewElapsed === undefined && elapsed >= getLightComboMotionDuration(swing.comboStep))
			) {
				resetSwing(swing);
				this.activeSwings.delete(character);
				continue;
			}

			for (const [joint, driver] of swing.drivers) driver.apply(pose[joint]);
		}
	}
}
