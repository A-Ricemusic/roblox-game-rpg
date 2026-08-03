import { defineConfig } from "@isentinel/jest-roblox";

export default defineConfig({
	extends: "./jest.config.mjs",
	test: {
		collectCoverage: false,
		testMatch: ["**/*.staging.spec.ts"],
		testPathIgnorePatterns: ["/node_modules/", "/out/"],
		verbose: true,
	},
});
