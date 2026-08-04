import { RunService, Workspace } from "@rbxts/services";
import { LightComboStep } from "shared/weapons/LightCombo";
import { getLightComboMotionDuration, sampleLightComboMotion, SwordPoseJoint } from "shared/weapons/SwordMotion";
import { sampleHopliteSwordIdle, sampleHopliteSwordRun } from "shared/weapons/SwordLocomotion";
import { EQUIPPED_WEAPON_NAME } from "shared/weapons/WeaponConstants";

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
	readonly calibration: WeaponPoseCalibration;
}

interface LocomotionState {
	readonly drivers: ReadonlyMap<SwordPoseJoint, JointPoseDriver>;
	phase: number;
	elapsed: number;
	applied: boolean;
}

interface WeaponPoseCalibration {
	readonly forwardWrist: CFrame;
	readonly spinLeftShoulder: CFrame;
	readonly spinLeftElbow: CFrame;
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
		poseJoint: "rightWrist",
		preferredParentName: "RightHand",
		jointNames: new Set(["RightWrist", "Right Wrist"]),
		connectedPartNames: new Set(["RightHand"]),
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
		poseJoint: "leftWrist",
		preferredParentName: "LeftHand",
		jointNames: new Set(["LeftWrist", "Left Wrist"]),
		connectedPartNames: new Set(["LeftHand"]),
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
		poseJoint: "rightAnkle",
		preferredParentName: "RightFoot",
		jointNames: new Set(["RightAnkle", "Right Ankle"]),
		connectedPartNames: new Set(["RightFoot"]),
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
	{
		poseJoint: "leftAnkle",
		preferredParentName: "LeftFoot",
		jointNames: new Set(["LeftAnkle", "Left Ankle"]),
		connectedPartNames: new Set(["LeftFoot"]),
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

function getAttachment(character: Model, name: string): Attachment | undefined {
	const weapon = character.FindFirstChild(EQUIPPED_WEAPON_NAME);
	const candidate = weapon?.FindFirstChild(name, true);
	return candidate?.IsA("Attachment") === true ? candidate : undefined;
}

function applyPose(
	drivers: ReadonlyMap<SwordPoseJoint, JointPoseDriver>,
	pose: NonNullable<ReturnType<typeof sampleLightComboMotion>>,
): void {
	for (const [joint, driver] of drivers) driver.apply(pose[joint]);
}

function resetDrivers(drivers: ReadonlyMap<SwordPoseJoint, JointPoseDriver>): void {
	for (const [, driver] of drivers) driver.reset();
}

export class ProceduralSwordAnimator {
	private readonly activeSwings = new Map<Model, ActiveSwing>();
	private readonly locomotionStates = new Map<Model, LocomotionState>();
	private readonly calibrations = new Map<Model, WeaponPoseCalibration>();
	private readonly frameConnection: RBXScriptConnection;
	private destroyed = false;

	public constructor() {
		this.frameConnection = RunService.PreSimulation.Connect((deltaTime) => this.update(deltaTime));
	}

	public registerCharacter(character: Model): boolean {
		if (this.destroyed) return false;
		if (this.locomotionStates.has(character)) return true;
		const drivers = resolvePoseDrivers(character);
		if (!drivers.has("rightShoulder")) return false;
		this.locomotionStates.set(character, { drivers, phase: 0, elapsed: 0, applied: false });
		return true;
	}

	public playLightSwing(character: Model, startedAt: number, comboStep: LightComboStep): boolean {
		if (this.destroyed) return false;

		this.registerCharacter(character);
		const drivers = this.locomotionStates.get(character)?.drivers ?? resolvePoseDrivers(character);
		if (!drivers.has("rightShoulder")) {
			warn(`[WeaponAnimator] ${character.GetFullName()} has no supported right-shoulder joint.`);
			return false;
		}

		this.activeSwings.set(character, {
			startedAt,
			comboStep,
			drivers,
			calibration: this.getOrCreateCalibration(character, drivers),
		});
		return true;
	}

	public previewLightSwing(character: Model, comboStep: LightComboStep, elapsedSeconds: number): boolean {
		if (this.destroyed) return false;

		this.registerCharacter(character);
		const drivers = this.locomotionStates.get(character)?.drivers ?? resolvePoseDrivers(character);
		if (!drivers.has("rightShoulder")) return false;

		const swing: ActiveSwing = {
			startedAt: 0,
			comboStep,
			drivers,
			previewElapsed: math.clamp(elapsedSeconds, 0, getLightComboMotionDuration(comboStep)),
			calibration: this.getOrCreateCalibration(character, drivers),
		};
		this.activeSwings.set(character, swing);
		const previewPose = sampleLightComboMotion(comboStep, swing.previewElapsed ?? 0);
		if (previewPose !== undefined) this.applySwingPose(swing, previewPose);
		return true;
	}

	public clearCharacter(character: Model): void {
		const swing = this.activeSwings.get(character);
		if (swing !== undefined) {
			resetSwing(swing);
			this.activeSwings.delete(character);
		}
		const locomotion = this.locomotionStates.get(character);
		if (locomotion !== undefined) {
			resetDrivers(locomotion.drivers);
			this.locomotionStates.delete(character);
		}
		this.calibrations.delete(character);
	}

	public destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.frameConnection.Disconnect();
		for (const [, swing] of this.activeSwings) resetSwing(swing);
		this.activeSwings.clear();
		for (const [, state] of this.locomotionStates) resetDrivers(state.drivers);
		this.locomotionStates.clear();
		this.calibrations.clear();
	}

	private update(deltaTime: number): void {
		const now = Workspace.GetServerTimeNow();
		for (const [character, state] of this.locomotionStates) {
			if (character.Parent === undefined) {
				resetDrivers(state.drivers);
				this.locomotionStates.delete(character);
				this.calibrations.delete(character);
				continue;
			}
			if (this.activeSwings.has(character)) continue;
			const humanoid = character.FindFirstChildOfClass("Humanoid");
			const root = character.FindFirstChild("HumanoidRootPart");
			const equipped = character.FindFirstChild(EQUIPPED_WEAPON_NAME) !== undefined;
			const supportedState =
				humanoid !== undefined &&
				humanoid.Health > 0 &&
				humanoid.GetState() !== Enum.HumanoidStateType.Climbing &&
				humanoid.GetState() !== Enum.HumanoidStateType.Swimming &&
				humanoid.GetState() !== Enum.HumanoidStateType.Freefall;
			if (!equipped || !supportedState || root?.IsA("BasePart") !== true) {
				if (state.applied) resetDrivers(state.drivers);
				state.applied = false;
				continue;
			}
			state.elapsed += deltaTime;
			const horizontalVelocity = new Vector3(root.AssemblyLinearVelocity.X, 0, root.AssemblyLinearVelocity.Z)
				.Magnitude;
			const moving = humanoid.MoveDirection.Magnitude > 0.08 || horizontalVelocity > 0.65;
			const speedAlpha = math.clamp(horizontalVelocity / math.max(humanoid.WalkSpeed, 1), 0, 1.4);
			if (moving) state.phase += deltaTime * (7 + speedAlpha * 4.5);
			const pose = moving
				? sampleHopliteSwordRun(state.phase, speedAlpha)
				: sampleHopliteSwordIdle(state.elapsed);
			for (const [joint, driver] of state.drivers) driver.apply(pose[joint]);
			state.applied = true;
		}
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

			this.applySwingPose(swing, pose);
		}
	}

	private applySwingPose(swing: ActiveSwing, pose: NonNullable<ReturnType<typeof sampleLightComboMotion>>): void {
		for (const [joint, driver] of swing.drivers) {
			let transform = pose[joint];
			if ((swing.comboStep === 3 || swing.comboStep === 4) && joint === "rightWrist") {
				transform = swing.calibration.forwardWrist;
			}
			if (swing.comboStep === 4 && joint === "leftShoulder") {
				transform = swing.calibration.spinLeftShoulder;
			}
			if (swing.comboStep === 4 && joint === "leftElbow") transform = swing.calibration.spinLeftElbow;
			driver.apply(transform);
		}
	}

	private getOrCreateCalibration(
		character: Model,
		drivers: ReadonlyMap<SwordPoseJoint, JointPoseDriver>,
	): WeaponPoseCalibration {
		const existing = this.calibrations.get(character);
		if (existing !== undefined) return existing;
		const bladeStart = getAttachment(character, "HitboxStart");
		const bladeEnd = getAttachment(character, "HitboxEnd");
		const primaryGrip = getAttachment(character, "PrimaryGrip");
		const torso = character.FindFirstChild("UpperTorso") ?? character.FindFirstChild("Torso");
		const leftHand = character.FindFirstChild("LeftHand") ?? character.FindFirstChild("Left Arm");
		const stabPose = sampleLightComboMotion(3, 0.5);
		let bestWristDegrees = -10;
		let bestWristScore = -math.huge;
		if (
			stabPose !== undefined &&
			bladeStart !== undefined &&
			bladeEnd !== undefined &&
			torso?.IsA("BasePart") === true
		) {
			applyPose(drivers, stabPose);
			const wristDriver = drivers.get("rightWrist");
			if (wristDriver !== undefined) {
				for (let degrees = -180; degrees <= 180; degrees += 2) {
					wristDriver.apply(CFrame.Angles(math.rad(degrees), 0, 0));
					const blade = bladeEnd.WorldPosition.sub(bladeStart.WorldPosition);
					if (blade.Magnitude <= 0.001) continue;
					const direction = blade.Unit;
					const score = direction.Dot(torso.CFrame.LookVector) - math.abs(direction.Dot(Vector3.yAxis)) * 2;
					if (score > bestWristScore) {
						bestWristScore = score;
						bestWristDegrees = degrees;
					}
				}
			}
		}
		const forwardWrist = CFrame.Angles(math.rad(bestWristDegrees), 0, 0);
		let spinLeftShoulder = CFrame.Angles(math.rad(90), 0, math.rad(-18));
		let spinLeftElbow = CFrame.Angles(math.rad(-10), 0, 0);
		const spinPose = sampleLightComboMotion(4, 0.5);
		if (spinPose !== undefined && primaryGrip !== undefined && leftHand?.IsA("BasePart") === true) {
			applyPose(drivers, spinPose);
			drivers.get("rightWrist")?.apply(forwardWrist);
			const shoulderDriver = drivers.get("leftShoulder");
			const elbowDriver = drivers.get("leftElbow");
			if (shoulderDriver !== undefined && elbowDriver !== undefined) {
				let bestDistance = math.huge;
				for (let y = -30; y <= 30; y += 5) {
					for (let z = -45; z <= 45; z += 5) {
						for (let elbow = -30; elbow <= 0; elbow += 10) {
							const shoulder = CFrame.Angles(math.rad(90), math.rad(y), math.rad(z));
							const elbowPose = CFrame.Angles(math.rad(elbow), 0, 0);
							shoulderDriver.apply(shoulder);
							elbowDriver.apply(elbowPose);
							const distance = leftHand.Position.sub(primaryGrip.WorldPosition).Magnitude;
							if (distance < bestDistance) {
								bestDistance = distance;
								spinLeftShoulder = shoulder;
								spinLeftElbow = elbowPose;
							}
						}
					}
				}
			}
		}
		resetDrivers(drivers);
		const calibration = { forwardWrist, spinLeftShoulder, spinLeftElbow };
		this.calibrations.set(character, calibration);
		return calibration;
	}
}
