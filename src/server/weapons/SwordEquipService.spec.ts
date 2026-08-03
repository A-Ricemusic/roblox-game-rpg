import { describe, expect, it } from "@rbxts/jest-globals";
import { EQUIPPED_WEAPON_NAME, WEAPON_GRIP_MOTOR_NAME } from "shared/weapons/WeaponConstants";
import { equipSword, hasEquippedStarterSword, unequipSword } from "./SwordEquipService";

function createCharacterFixture(): Model {
	const character = new Instance("Model");
	character.Name = "CharacterFixture";

	const rightHand = new Instance("Part");
	rightHand.Name = "RightHand";
	rightHand.CFrame = new CFrame(4, 5, 6);
	rightHand.Parent = character;

	const handGrip = new Instance("Attachment");
	handGrip.Name = "RightGripAttachment";
	handGrip.CFrame = new CFrame(0, -0.5, 0);
	handGrip.Parent = rightHand;

	return character;
}

function createSwordFixture(): Model {
	const sword = new Instance("Model");
	sword.Name = "HopliteSword";

	const root = new Instance("Part");
	root.Name = "WeaponRoot";
	root.CFrame = new CFrame();
	root.Parent = sword;
	sword.PrimaryPart = root;

	for (const name of ["PrimaryGrip", "HitboxStart", "HitboxEnd"]) {
		const attachment = new Instance("Attachment");
		attachment.Name = name;
		attachment.Parent = root;
	}

	const primaryGrip = root.FindFirstChild("PrimaryGrip") as Attachment;
	primaryGrip.CFrame = new CFrame(0, -1, 0);
	return sword;
}

describe("equipSword", () => {
	it("clones and connects the weapon by matching grip attachments", () => {
		const character = createCharacterFixture();
		const template = createSwordFixture();
		const result = equipSword(character, template);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.equipped.Parent).toBe(character);
			expect(result.equipped.Name).toBe(EQUIPPED_WEAPON_NAME);
			expect(result.gripMotor.Name).toBe(WEAPON_GRIP_MOTOR_NAME);
			expect(result.gripMotor.Part0?.Name).toBe("RightHand");
			expect(result.gripMotor.Part1?.Name).toBe("WeaponRoot");
			expect(result.gripMotor.C0).toEqual(new CFrame(0, -0.5, 0));
			expect(result.gripMotor.C1).toEqual(new CFrame(0, -1, 0));

			const rightHand = character.FindFirstChild("RightHand") as BasePart;
			const handGrip = rightHand.FindFirstChild("RightGripAttachment") as Attachment;
			const weaponRoot = result.gripMotor.Part1 as BasePart;
			const weaponGrip = weaponRoot.FindFirstChild("PrimaryGrip") as Attachment;
			expect(weaponGrip.WorldCFrame).toEqual(handGrip.WorldCFrame);
			expect(weaponRoot.Anchored).toBe(false);
			expect(weaponRoot.CanCollide).toBe(false);
			expect(weaponRoot.CanTouch).toBe(false);
			expect(weaponRoot.CanQuery).toBe(false);
			expect(weaponRoot.Massless).toBe(true);
			expect(hasEquippedStarterSword(character)).toBe(true);
		}

		character.Destroy();
		template.Destroy();
	});

	it("replaces the previous weapon and grip motor", () => {
		const character = createCharacterFixture();
		const template = createSwordFixture();
		expect(equipSword(character, template).success).toBe(true);
		expect(equipSword(character, template).success).toBe(true);

		const rightHand = character.FindFirstChild("RightHand") as BasePart;
		const gripMotors = rightHand
			.GetChildren()
			.filter((child): child is Motor6D => child.IsA("Motor6D") && child.Name === WEAPON_GRIP_MOTOR_NAME);
		expect(gripMotors.size()).toBe(1);
		expect(
			character
				.GetChildren()
				.filter((child) => child.Name === EQUIPPED_WEAPON_NAME)
				.size(),
		).toBe(1);

		character.Destroy();
		template.Destroy();
	});

	it("removes both the equipped model and its hand grip", () => {
		const character = createCharacterFixture();
		const template = createSwordFixture();
		expect(equipSword(character, template).success).toBe(true);

		expect(unequipSword(character)).toBe(true);
		expect(hasEquippedStarterSword(character)).toBe(false);
		expect(character.FindFirstChild(EQUIPPED_WEAPON_NAME)).toBeUndefined();
		expect(character.FindFirstChild("RightHand")?.FindFirstChild(WEAPON_GRIP_MOTOR_NAME)).toBeUndefined();
		expect(unequipSword(character)).toBe(false);

		character.Destroy();
		template.Destroy();
	});

	it("returns a useful error for non-R15 characters", () => {
		const character = new Instance("Model");
		const template = createSwordFixture();
		const result = equipSword(character, template);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.message).toContain("RightHand");
		}

		character.Destroy();
		template.Destroy();
	});

	it("preserves the current sword when its replacement is invalid", () => {
		const character = createCharacterFixture();
		const validTemplate = createSwordFixture();
		const invalidTemplate = createSwordFixture();
		invalidTemplate.PrimaryPart?.FindFirstChild("HitboxEnd")?.Destroy();
		expect(equipSword(character, validTemplate).success).toBe(true);
		const existing = character.FindFirstChild(EQUIPPED_WEAPON_NAME);

		expect(equipSword(character, invalidTemplate).success).toBe(false);
		expect(character.FindFirstChild(EQUIPPED_WEAPON_NAME)).toBe(existing);
		expect(hasEquippedStarterSword(character)).toBe(true);

		character.Destroy();
		validTemplate.Destroy();
		invalidTemplate.Destroy();
	});
});
