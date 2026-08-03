import {
	EQUIPPED_WEAPON_NAME,
	STARTER_WEAPON_ASSET_NAME,
	STARTER_WEAPON_ID,
	WEAPON_GRIP_MOTOR_NAME,
} from "shared/weapons/WeaponConstants";
import { validateSwordAsset } from "shared/weapons/SwordAssetContract";

export type SwordEquipResult =
	| { readonly success: true; readonly equipped: Instance; readonly gripMotor: Motor6D }
	| { readonly success: false; readonly message: string };

function configureWeaponParts(asset: Instance): void {
	const candidates = asset.IsA("BasePart") ? [asset, ...asset.GetDescendants()] : asset.GetDescendants();
	for (const candidate of candidates) {
		if (candidate.IsA("BasePart")) {
			candidate.Anchored = false;
			candidate.CanCollide = false;
			candidate.CanTouch = false;
			candidate.CanQuery = false;
			candidate.Massless = true;
		}
	}
}

export function equipSword(character: Model, swordTemplate: Instance): SwordEquipResult {
	const rightHand = character.FindFirstChild("RightHand");
	if (rightHand === undefined || !rightHand.IsA("BasePart")) {
		return { success: false, message: `${character.GetFullName()} requires an R15 RightHand.` };
	}

	const handGrip = rightHand.FindFirstChild("RightGripAttachment");
	if (handGrip === undefined || !handGrip.IsA("Attachment")) {
		return { success: false, message: `${rightHand.GetFullName()} is missing RightGripAttachment.` };
	}

	const equipped = swordTemplate.Clone();
	equipped.Name = EQUIPPED_WEAPON_NAME;
	const validation = validateSwordAsset(equipped);
	if (!validation.success) {
		equipped.Destroy();
		return validation;
	}

	for (const child of rightHand.GetChildren()) {
		if (child.Name === WEAPON_GRIP_MOTOR_NAME) {
			child.Destroy();
		}
	}

	const existing = character.FindFirstChild(EQUIPPED_WEAPON_NAME);
	if (existing !== undefined) {
		existing.Destroy();
	}

	configureWeaponParts(equipped);
	const { root, primaryGrip } = validation.parts;
	root.CFrame = rightHand.CFrame.mul(handGrip.CFrame).mul(primaryGrip.CFrame.Inverse());
	equipped.SetAttribute("WeaponId", STARTER_WEAPON_ID);
	equipped.Parent = character;

	const gripMotor = new Instance("Motor6D");
	gripMotor.Name = WEAPON_GRIP_MOTOR_NAME;
	gripMotor.Part0 = rightHand;
	gripMotor.Part1 = root;
	gripMotor.C0 = handGrip.CFrame;
	gripMotor.C1 = primaryGrip.CFrame;
	gripMotor.Parent = rightHand;

	return { success: true, equipped, gripMotor };
}

export function hasEquippedStarterSword(character: Model): boolean {
	const equipped = character.FindFirstChild(EQUIPPED_WEAPON_NAME);
	if (equipped === undefined || equipped.GetAttribute("WeaponId") !== STARTER_WEAPON_ID) {
		return false;
	}

	const validation = validateSwordAsset(equipped);
	if (!validation.success) {
		return false;
	}

	const rightHand = character.FindFirstChild("RightHand");
	const gripMotor = rightHand?.FindFirstChild(WEAPON_GRIP_MOTOR_NAME);
	return (
		gripMotor?.IsA("Motor6D") === true && gripMotor.Part0 === rightHand && gripMotor.Part1 === validation.parts.root
	);
}

export function unequipSword(character: Model): boolean {
	let changed = false;
	const rightHand = character.FindFirstChild("RightHand");
	const gripMotor = rightHand?.FindFirstChild(WEAPON_GRIP_MOTOR_NAME);
	if (gripMotor !== undefined) {
		gripMotor.Destroy();
		changed = true;
	}

	const equipped = character.FindFirstChild(EQUIPPED_WEAPON_NAME);
	if (equipped !== undefined) {
		equipped.Destroy();
		changed = true;
	}
	return changed;
}

export function findStarterSwordTemplate(replicatedStorage: ReplicatedStorage): Instance | undefined {
	return replicatedStorage
		.FindFirstChild("Assets")
		?.FindFirstChild("Weapons")
		?.FindFirstChild(STARTER_WEAPON_ASSET_NAME);
}
