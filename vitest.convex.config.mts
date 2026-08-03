import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["convex/**/*.test.ts"],
		environment: "node",
		coverage: {
			provider: "v8",
			include: ["convex/**/*.ts"],
			exclude: ["convex/_generated/**", "convex/**/*.test.ts"],
			thresholds: {
				branches: 80,
				functions: 80,
				lines: 80,
				statements: 80,
			},
		},
	},
});
