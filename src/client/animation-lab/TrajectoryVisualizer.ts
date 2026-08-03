import { Workspace } from "@rbxts/services";

const MAX_SEGMENTS = 160;

export class TrajectoryVisualizer {
	private readonly folder = new Instance("Folder");
	private readonly segments = new Array<BasePart>();
	private previousPosition?: Vector3;

	public constructor() {
		this.folder.Name = "AnimationLabTrajectory";
		this.folder.Parent = Workspace;
	}

	public add(position: Vector3): void {
		const previous = this.previousPosition;
		this.previousPosition = position;
		if (previous === undefined) return;
		const distance = position.sub(previous).Magnitude;
		if (distance < 0.01) return;

		const segment = new Instance("Part");
		segment.Name = "SwordTipTrail";
		segment.Anchored = true;
		segment.CanCollide = false;
		segment.CanQuery = false;
		segment.CanTouch = false;
		segment.Material = Enum.Material.Neon;
		segment.Color = Color3.fromRGB(255, 190, 45);
		segment.Size = new Vector3(0.055, 0.055, distance);
		segment.CFrame = CFrame.lookAt(previous.Lerp(position, 0.5), position);
		segment.Parent = this.folder;
		this.segments.push(segment);
		if (this.segments.size() > MAX_SEGMENTS) this.segments.shift()?.Destroy();
	}

	public clear(): void {
		this.previousPosition = undefined;
		for (const segment of this.segments) segment.Destroy();
		this.segments.clear();
	}

	public destroy(): void {
		this.clear();
		this.folder.Destroy();
	}
}
