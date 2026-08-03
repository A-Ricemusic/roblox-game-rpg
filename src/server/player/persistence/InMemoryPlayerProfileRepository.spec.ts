import { describe, expect, it } from "@rbxts/jest-globals";

import { createEmptyPlayerProfile } from "shared/player/PlayerProfile";

import { InMemoryPlayerProfileRepository } from "./InMemoryPlayerProfileRepository";

describe("InMemoryPlayerProfileRepository", () => {
	it("stores aggregate profiles without external persistence", () => {
		const repository = new InMemoryPlayerProfileRepository();
		const profile = createEmptyPlayerProfile();
		expect(repository.load("player:1")).toEqual({ ok: true, value: undefined });
		expect(repository.save("player:1", profile).ok).toBe(true);
		expect(repository.load("player:1")).toEqual({ ok: true, value: profile });
		expect(repository.abandon("player:1").ok).toBe(true);
	});
});
