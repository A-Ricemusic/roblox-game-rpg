import { defineConfig } from "@isentinel/jest-roblox";

export default defineConfig({
	backend: "auto",
	placeFile: "./test.rbxl",
	rojoProject: "./test.project.json",
	sourceMap: true,
	test: {
		collectCoverage: false,
		coverageDirectory: "coverage",
		coveragePathIgnorePatterns: [
			"/node_modules/",
			"\\.spec\\.ts$",
			"\\.staging\\.spec\\.ts$",
			"DataStoreQuestProfileRepository\\.ts$",
		],
		coverageReporters: ["text", "lcov"],
		coverageThreshold: {
			branches: 80,
			functions: 85,
			lines: 85,
			statements: 85,
		},
		testMatch: ["**/*.spec.ts"],
		testPathIgnorePatterns: ["/node_modules/", "/out/", "\\.staging\\.spec\\.ts$"],
		verbose: true,
	},
	timeout: 120_000,
});
