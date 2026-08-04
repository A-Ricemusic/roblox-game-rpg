export interface TargetCandidate {
	character: Model;
	humanoid: Humanoid;
	root: BasePart;
}

export function findNearestLivingTarget(
	origin: Vector3,
	characters: readonly (Model | undefined)[],
	maximumDistance: number,
): TargetCandidate | undefined {
	let nearest: TargetCandidate | undefined;
	let nearestDistance = maximumDistance;
	for (const character of characters) {
		if (character === undefined) continue;
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		const root = character.FindFirstChild("HumanoidRootPart");
		if (humanoid === undefined || !root?.IsA("BasePart") || humanoid.Health <= 0) continue;
		const distance = root.Position.sub(origin).Magnitude;
		if (distance >= nearestDistance) continue;
		nearestDistance = distance;
		nearest = { character, humanoid, root };
	}
	return nearest;
}
