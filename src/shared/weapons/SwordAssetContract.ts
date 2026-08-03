export interface SwordAssetParts {
	readonly root: BasePart;
	readonly primaryGrip: Attachment;
	readonly hitboxStart: Attachment;
	readonly hitboxEnd: Attachment;
	readonly tip?: Attachment;
}

export type SwordAssetValidationResult =
	{ readonly success: true; readonly parts: SwordAssetParts } | { readonly success: false; readonly message: string };

function findUniqueDirectAttachment(parent: Instance, name: string): Attachment | undefined {
	let found: Attachment | undefined;
	for (const child of parent.GetChildren()) {
		if (child.Name !== name) continue;
		if (!child.IsA("Attachment") || found !== undefined) return undefined;
		found = child;
	}
	return found;
}

function findExecutable(asset: Instance): LuaSourceContainer | undefined {
	for (const descendant of asset.GetDescendants()) {
		if (descendant.IsA("LuaSourceContainer")) return descendant;
	}
	return undefined;
}

export function validateSwordAsset(asset: Instance): SwordAssetValidationResult {
	const rootCandidate = asset.IsA("BasePart") ? asset : asset.FindFirstChild("WeaponRoot");
	if (rootCandidate === undefined || !rootCandidate.IsA("BasePart")) {
		return {
			success: false,
			message: `${asset.GetFullName()} must be a BasePart or contain a BasePart named WeaponRoot.`,
		};
	}
	if (asset.IsA("Model") && asset.PrimaryPart !== rootCandidate) {
		return { success: false, message: `${asset.GetFullName()} must use WeaponRoot as its PrimaryPart.` };
	}

	const executable = findExecutable(asset);
	if (executable !== undefined) {
		return {
			success: false,
			message: `${asset.GetFullName()} must not contain executable ${executable.ClassName}s.`,
		};
	}

	const primaryGrip = findUniqueDirectAttachment(rootCandidate, "PrimaryGrip");
	if (primaryGrip === undefined) {
		return {
			success: false,
			message: `${rootCandidate.GetFullName()} requires exactly one Attachment PrimaryGrip.`,
		};
	}

	const hitboxStart = findUniqueDirectAttachment(rootCandidate, "HitboxStart");
	if (hitboxStart === undefined) {
		return {
			success: false,
			message: `${rootCandidate.GetFullName()} requires exactly one Attachment HitboxStart.`,
		};
	}

	const hitboxEnd = findUniqueDirectAttachment(rootCandidate, "HitboxEnd");
	if (hitboxEnd === undefined) {
		return { success: false, message: `${rootCandidate.GetFullName()} requires exactly one Attachment HitboxEnd.` };
	}

	return {
		success: true,
		parts: {
			root: rootCandidate,
			primaryGrip,
			hitboxStart,
			hitboxEnd,
			tip: findUniqueDirectAttachment(rootCandidate, "Tip"),
		},
	};
}
