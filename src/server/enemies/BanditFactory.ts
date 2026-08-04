import { CollectionService } from "@rbxts/services";

import { BANDIT_DEFAULTS, BANDIT_TAG } from "./BanditConstants";

const SKIN = Color3.fromRGB(151, 98, 66);
const LINEN = Color3.fromRGB(220, 207, 174);
const LEATHER = Color3.fromRGB(69, 38, 26);
const TROUSERS = Color3.fromRGB(66, 54, 49);

interface PartSpec {
	name: string;
	size: Vector3;
	color: Color3;
	parent: string;
	offset: CFrame;
	joint: string;
}

function makePart(model: Model, name: string, size: Vector3, color: Color3): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Size = size;
	part.Color = color;
	part.Material = Enum.Material.SmoothPlastic;
	part.CanCollide = false;
	part.CanQuery = name === "HumanoidRootPart";
	part.Massless = name !== "HumanoidRootPart";
	part.TopSurface = Enum.SurfaceType.Smooth;
	part.BottomSurface = Enum.SurfaceType.Smooth;
	part.Parent = model;
	return part;
}

function attach(part0: BasePart, part1: BasePart, name: string, offset: CFrame): Motor6D {
	part1.CFrame = part0.CFrame.mul(offset);
	const motor = new Instance("Motor6D");
	motor.Name = name;
	motor.Part0 = part0;
	motor.Part1 = part1;
	motor.C0 = offset;
	motor.Parent = part0;
	return motor;
}

function weldDecoration(
	parent: BasePart,
	name: string,
	size: Vector3,
	color: Color3,
	offset: CFrame,
	shape?: Enum.PartType,
): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Size = size;
	part.Color = color;
	part.Material = Enum.Material.SmoothPlastic;
	part.CanCollide = false;
	part.CanQuery = false;
	part.Massless = true;
	if (shape !== undefined) part.Shape = shape;
	part.CFrame = parent.CFrame.mul(offset);
	part.Parent = parent.Parent;
	const weld = new Instance("WeldConstraint");
	weld.Part0 = parent;
	weld.Part1 = part;
	weld.Parent = part;
	return part;
}

export function createBandit(spawnCFrame: CFrame): Model {
	const model = new Instance("Model");
	model.Name = "SicilianBandit";
	const root = makePart(model, "HumanoidRootPart", new Vector3(2, 2, 1), Color3.fromRGB(40, 40, 40));
	root.Transparency = 1;
	root.CFrame = spawnCFrame;
	root.CanCollide = true;

	const lowerTorso = makePart(model, "LowerTorso", new Vector3(2, 1.8, 1.1), TROUSERS);
	attach(root, lowerTorso, "Root", new CFrame(0, 0, 0));
	const upperTorso = makePart(model, "UpperTorso", new Vector3(2.4, 2.2, 1.2), LINEN);
	attach(lowerTorso, upperTorso, "Waist", new CFrame(0, 1.75, 0));
	const head = makePart(model, "Head", new Vector3(1.75, 1.2, 1.25), SKIN);
	attach(upperTorso, head, "Neck", new CFrame(0, 1.75, 0));

	const specs: PartSpec[] = [
		{
			name: "LeftUpperArm",
			size: new Vector3(0.8, 1.45, 0.8),
			color: SKIN,
			parent: "UpperTorso",
			offset: new CFrame(-1.55, 0.45, 0),
			joint: "LeftShoulder",
		},
		{
			name: "LeftLowerArm",
			size: new Vector3(0.7, 1.35, 0.7),
			color: SKIN,
			parent: "LeftUpperArm",
			offset: new CFrame(0, -1.35, 0),
			joint: "LeftElbow",
		},
		{
			name: "LeftHand",
			size: new Vector3(0.72, 0.65, 0.72),
			color: SKIN,
			parent: "LeftLowerArm",
			offset: new CFrame(0, -1, 0),
			joint: "LeftWrist",
		},
		{
			name: "RightUpperArm",
			size: new Vector3(0.8, 1.45, 0.8),
			color: SKIN,
			parent: "UpperTorso",
			offset: new CFrame(1.55, 0.45, 0),
			joint: "RightShoulder",
		},
		{
			name: "RightLowerArm",
			size: new Vector3(0.7, 1.35, 0.7),
			color: SKIN,
			parent: "RightUpperArm",
			offset: new CFrame(0, -1.35, 0),
			joint: "RightElbow",
		},
		{
			name: "RightHand",
			size: new Vector3(0.72, 0.65, 0.72),
			color: SKIN,
			parent: "RightLowerArm",
			offset: new CFrame(0, -1, 0),
			joint: "RightWrist",
		},
		{
			name: "LeftUpperLeg",
			size: new Vector3(0.9, 1.55, 0.9),
			color: TROUSERS,
			parent: "LowerTorso",
			offset: new CFrame(-0.55, -1.6, 0),
			joint: "LeftHip",
		},
		{
			name: "LeftLowerLeg",
			size: new Vector3(0.78, 1.55, 0.78),
			color: SKIN,
			parent: "LeftUpperLeg",
			offset: new CFrame(0, -1.5, 0),
			joint: "LeftKnee",
		},
		{
			name: "LeftFoot",
			size: new Vector3(0.85, 0.55, 1.25),
			color: LEATHER,
			parent: "LeftLowerLeg",
			offset: new CFrame(0, -1.05, -0.2),
			joint: "LeftAnkle",
		},
		{
			name: "RightUpperLeg",
			size: new Vector3(0.9, 1.55, 0.9),
			color: TROUSERS,
			parent: "LowerTorso",
			offset: new CFrame(0.55, -1.6, 0),
			joint: "RightHip",
		},
		{
			name: "RightLowerLeg",
			size: new Vector3(0.78, 1.55, 0.78),
			color: SKIN,
			parent: "RightUpperLeg",
			offset: new CFrame(0, -1.5, 0),
			joint: "RightKnee",
		},
		{
			name: "RightFoot",
			size: new Vector3(0.85, 0.55, 1.25),
			color: LEATHER,
			parent: "RightLowerLeg",
			offset: new CFrame(0, -1.05, -0.2),
			joint: "RightAnkle",
		},
	];
	const byName = new Map<string, BasePart>([
		[root.Name, root],
		[lowerTorso.Name, lowerTorso],
		[upperTorso.Name, upperTorso],
		[head.Name, head],
	]);
	for (const spec of specs) {
		const parent = byName.get(spec.parent);
		if (parent === undefined) error(`Missing bandit parent ${spec.parent}`);
		const part = makePart(model, spec.name, spec.size, spec.color);
		attach(parent, part, spec.joint, spec.offset);
		byName.set(spec.name, part);
	}

	weldDecoration(head, "BlackCurls", new Vector3(1.9, 0.38, 1.4), Color3.fromRGB(25, 19, 17), new CFrame(0, 0.58, 0));
	weldDecoration(head, "Bandana", new Vector3(1.93, 0.26, 1.43), Color3.fromRGB(127, 31, 29), new CFrame(0, 0.4, 0));
	weldDecoration(
		upperTorso,
		"RedSash",
		new Vector3(0.32, 2.6, 1.28),
		Color3.fromRGB(139, 35, 31),
		CFrame.Angles(0, 0, -0.55),
	);
	weldDecoration(lowerTorso, "LeatherBelt", new Vector3(2.18, 0.3, 1.2), LEATHER, new CFrame(0, 0.5, 0));
	const dagger = weldDecoration(
		byName.get("RightHand")!,
		"BanditDagger",
		new Vector3(0.18, 0.18, 2.3),
		Color3.fromRGB(176, 181, 184),
		new CFrame(0, -0.25, -1.15).mul(CFrame.Angles(math.rad(90), 0, 0)),
	);
	dagger.Material = Enum.Material.Metal;

	const humanoid = new Instance("Humanoid");
	humanoid.Name = "Humanoid";
	humanoid.RigType = Enum.HumanoidRigType.R15;
	humanoid.MaxHealth = 100;
	humanoid.Health = 100;
	humanoid.WalkSpeed = BANDIT_DEFAULTS.walkSpeed;
	humanoid.DisplayName = "Sicilian Bandit";
	humanoid.Parent = model;
	const animator = new Instance("Animator");
	animator.Parent = humanoid;
	model.PrimaryPart = root;
	model.SetAttribute("DetectionRadius", BANDIT_DEFAULTS.detectionRadius);
	model.SetAttribute("AttackRange", BANDIT_DEFAULTS.attackRange);
	model.SetAttribute("Damage", BANDIT_DEFAULTS.damage);
	model.SetAttribute("AttackCooldown", BANDIT_DEFAULTS.attackCooldown);
	model.SetAttribute("WalkSpeed", BANDIT_DEFAULTS.walkSpeed);
	CollectionService.AddTag(model, BANDIT_TAG);
	return model;
}
