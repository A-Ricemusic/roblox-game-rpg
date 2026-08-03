import { describe, expect, it } from "@rbxts/jest-globals";

import {
	DEVELOPMENT_CONVEX_SITE_URL,
	PRODUCTION_CONVEX_SITE_URL,
	resolveConvexSiteUrl,
	resolveShouldMigrateDataStore,
} from "./PlayerDatabaseConfig";

describe("PlayerDatabaseConfig", () => {
	it("uses isolated environment defaults when Rojo-managed attributes are absent", () => {
		expect(resolveConvexSiteUrl(undefined, true)).toBe(DEVELOPMENT_CONVEX_SITE_URL);
		expect(resolveConvexSiteUrl(undefined, false)).toBe(PRODUCTION_CONVEX_SITE_URL);
		expect(resolveShouldMigrateDataStore(undefined, true)).toBe(false);
		expect(resolveShouldMigrateDataStore(undefined, false)).toBe(true);
	});

	it("allows explicit environment overrides", () => {
		expect(resolveConvexSiteUrl("https://custom.convex.site", true)).toBe("https://custom.convex.site");
		expect(resolveShouldMigrateDataStore(true, true)).toBe(true);
		expect(resolveShouldMigrateDataStore(false, false)).toBe(false);
	});

	it("ignores empty and incorrectly typed URL overrides", () => {
		expect(resolveConvexSiteUrl("", true)).toBe(DEVELOPMENT_CONVEX_SITE_URL);
		expect(resolveConvexSiteUrl(123, false)).toBe(PRODUCTION_CONVEX_SITE_URL);
	});
});
