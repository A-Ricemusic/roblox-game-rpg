import { afterEach, describe, expect, it } from "@rbxts/jest-globals";

import { CharacterResourceSource, CoreHealthVisibility, PlayerResourceController } from "./PlayerResourceController";
import { PlayerResourceHud } from "./PlayerResourceHud";

class FakeCharacterSource implements CharacterResourceSource {
	private readonly added = new Instance("BindableEvent");
	private readonly removing = new Instance("BindableEvent");
	private character?: Model;

	public getCharacter(): Model | undefined {
		return this.character;
	}

	public onCharacterAdded(callback: (character: Model) => void): RBXScriptConnection {
		return this.added.Event.Connect((value: unknown) => {
			if (typeIs(value, "Instance") && value.IsA("Model")) callback(value);
		});
	}

	public onCharacterRemoving(callback: (character: Model) => void): RBXScriptConnection {
		return this.removing.Event.Connect((value: unknown) => {
			if (typeIs(value, "Instance") && value.IsA("Model")) callback(value);
		});
	}

	public setCharacter(character: Model | undefined): void {
		const previous = this.character;
		this.character = character;
		if (previous !== undefined) this.removing.Fire(previous);
		if (character !== undefined) this.added.Fire(character);
	}

	public destroy(): void {
		this.added.Destroy();
		this.removing.Destroy();
	}
}

class FakeCoreHealthVisibility implements CoreHealthVisibility {
	public hides = 0;
	public restores = 0;
	public hide(): void {
		this.hides += 1;
	}
	public restore(): void {
		this.restores += 1;
	}
}

function characterWithHumanoid(
	health: number,
	maximum = 100,
): { readonly character: Model; readonly humanoid: Humanoid } {
	const character = new Instance("Model");
	const humanoid = new Instance("Humanoid");
	humanoid.MaxHealth = maximum;
	humanoid.Health = health;
	humanoid.Parent = character;
	return { character, humanoid };
}

let parent: Folder | undefined;
let hud: PlayerResourceHud | undefined;
let source: FakeCharacterSource | undefined;
let controller: PlayerResourceController | undefined;

afterEach(() => {
	controller?.stop();
	source?.destroy();
	hud?.destroy();
	parent?.Destroy();
	controller = undefined;
	source = undefined;
	hud = undefined;
	parent = undefined;
});

describe("PlayerResourceController", () => {
	it("binds current Humanoid health and updates maximum health", () => {
		parent = new Instance("Folder");
		hud = new PlayerResourceHud(parent, false);
		source = new FakeCharacterSource();
		const core = new FakeCoreHealthVisibility();
		const fixture = characterWithHumanoid(75);
		source.setCharacter(fixture.character);
		controller = new PlayerResourceController(hud, source, core);
		controller.start();
		expect(controller.getSnapshot().health).toEqual({ current: 75, maximum: 100 });
		expect(core.hides).toBe(1);

		fixture.humanoid.MaxHealth = 200;
		fixture.humanoid.Health = 150;
		expect(controller.getSnapshot().health).toEqual({ current: 150, maximum: 200 });
		controller.stop();
		expect(core.restores).toBe(1);
		fixture.character.Destroy();
	});

	it("binds a delayed Humanoid and ignores the previous character after respawn", () => {
		parent = new Instance("Folder");
		hud = new PlayerResourceHud(parent, false);
		source = new FakeCharacterSource();
		const first = new Instance("Model");
		source.setCharacter(first);
		controller = new PlayerResourceController(hud, source, new FakeCoreHealthVisibility());
		controller.start();
		expect(controller.getSnapshot().health.current).toBe(0);

		const delayedHumanoid = new Instance("Humanoid");
		delayedHumanoid.Health = 60;
		delayedHumanoid.Parent = first;
		expect(controller.getSnapshot().health.current).toBe(60);

		const second = characterWithHumanoid(90);
		source.setCharacter(second.character);
		expect(controller.getSnapshot().health.current).toBe(90);
		delayedHumanoid.Health = 10;
		expect(controller.getSnapshot().health.current).toBe(90);
		first.Destroy();
		second.character.Destroy();
	});

	it("keeps stamina and magic stable until their typed presentation APIs are used", () => {
		parent = new Instance("Folder");
		hud = new PlayerResourceHud(parent, false);
		source = new FakeCharacterSource();
		controller = new PlayerResourceController(hud, source, new FakeCoreHealthVisibility());
		controller.start();
		expect(controller.getSnapshot().stamina).toEqual({ current: 100, maximum: 100 });
		expect(controller.getSnapshot().magic).toEqual({ current: 100, maximum: 100 });
		controller.setStamina(40, 120);
		controller.setMagic(500, 200);
		expect(controller.getSnapshot().stamina).toEqual({ current: 40, maximum: 120 });
		expect(controller.getSnapshot().magic).toEqual({ current: 200, maximum: 200 });
	});
});
