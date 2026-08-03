import { describe, expect, it } from "@rbxts/jest-globals";
import { validateSwordAsset } from "./SwordAssetContract";

function createSwordFixture(): Model {
	const sword = new Instance("Model");
	sword.Name = "HopliteSword";

	const root = new Instance("Part");
	root.Name = "WeaponRoot";
	root.Parent = sword;
	sword.PrimaryPart = root;

	for (const name of ["PrimaryGrip", "HitboxStart", "HitboxEnd", "Tip"]) {
		const attachment = new Instance("Attachment");
		attachment.Name = name;
		attachment.Parent = root;
	}

	return sword;
}

describe("validateSwordAsset", () => {
	it("resolves the complete sword contract", () => {
		const sword = createSwordFixture();
		const result = validateSwordAsset(sword);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.parts.root.Name).toBe("WeaponRoot");
			expect(result.parts.primaryGrip.Name).toBe("PrimaryGrip");
			expect(result.parts.tip?.Name).toBe("Tip");
		}
		sword.Destroy();
	});

	it("supports a single BasePart weapon without a wrapper model", () => {
		const sword = new Instance("Part");
		sword.Name = "HopliteSword";
		for (const name of ["PrimaryGrip", "HitboxStart", "HitboxEnd"]) {
			const attachment = new Instance("Attachment");
			attachment.Name = name;
			attachment.Parent = sword;
		}

		const result = validateSwordAsset(sword);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.parts.root).toBe(sword);
		}
		sword.Destroy();
	});

	it("reports a missing required attachment", () => {
		const sword = createSwordFixture();
		sword.FindFirstChild("WeaponRoot")?.FindFirstChild("HitboxEnd")?.Destroy();
		const result = validateSwordAsset(sword);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.message).toContain("HitboxEnd");
		}
		sword.Destroy();
	});

	it("rejects ambiguous attachments, the wrong primary part, and executable descendants", () => {
		const duplicate = createSwordFixture();
		const duplicateGrip = new Instance("Attachment");
		duplicateGrip.Name = "PrimaryGrip";
		duplicateGrip.Parent = duplicate.PrimaryPart;
		expect(validateSwordAsset(duplicate).success).toBe(false);
		duplicate.Destroy();

		const wrongPrimaryPart = createSwordFixture();
		const decorativePart = new Instance("Part");
		decorativePart.Parent = wrongPrimaryPart;
		wrongPrimaryPart.PrimaryPart = decorativePart;
		expect(validateSwordAsset(wrongPrimaryPart).success).toBe(false);
		wrongPrimaryPart.Destroy();

		const scripted = createSwordFixture();
		const embeddedScript = new Instance("Script");
		embeddedScript.Parent = scripted;
		expect(validateSwordAsset(scripted).success).toBe(false);
		scripted.Destroy();
	});
});
