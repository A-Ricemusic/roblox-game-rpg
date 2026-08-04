import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { CollectionService } from "@rbxts/services";

import { BANDIT_TAG, readBanditTuning } from "./BanditConstants";
import { createBandit } from "./BanditFactory";

let bandit: Model | undefined;

afterEach(() => {
	bandit?.Destroy();
	bandit = undefined;
});

describe("BanditFactory", () => {
	it("creates a tagged R15-compatible hostile rig", () => {
		bandit = createBandit(new CFrame(4, 5, 6));
		expect(CollectionService.HasTag(bandit, BANDIT_TAG)).toBe(true);
		expect(bandit.FindFirstChildOfClass("Humanoid")?.RigType).toBe(Enum.HumanoidRigType.R15);
		expect(bandit.FindFirstChild("HumanoidRootPart")).toBeDefined();
		expect(
			bandit
				.GetDescendants()
				.filter((instance) => instance.IsA("Motor6D"))
				.size(),
		).toBe(15);
		expect(readBanditTuning(bandit).damage).toBe(18);
	});
});
