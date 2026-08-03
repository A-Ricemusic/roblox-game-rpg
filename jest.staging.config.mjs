import { defineConfig } from "@isentinel/jest-roblox";

export default defineConfig({
	extends: "./jest.config.mjs",
	placeFile: "./test-staging.rbxl",
	rojoProject: "./test.staging.project.json",
	test: {
		collectCoverage: false,
		testMatch: ["**/*.staging.spec.ts"],
		testPathIgnorePatterns: ["/node_modules/", "/out/"],
		verbose: true,
	},
});
