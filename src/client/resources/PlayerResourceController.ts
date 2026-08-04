import { Players, StarterGui } from "@rbxts/services";

import {
	createInitialPlayerResourceSnapshot,
	normalizePlayerResource,
	PlayerResourceSnapshot,
} from "shared/resources/PlayerResourceTypes";

import { PlayerResourceHud } from "./PlayerResourceHud";

const CORE_GUI_RETRY_ATTEMPTS = 8;
const CORE_GUI_RETRY_SECONDS = 0.25;

export interface CharacterResourceSource {
	getCharacter(): Model | undefined;
	onCharacterAdded(callback: (character: Model) => void): RBXScriptConnection;
	onCharacterRemoving(callback: (character: Model) => void): RBXScriptConnection;
}

export class RobloxCharacterResourceSource implements CharacterResourceSource {
	public getCharacter(): Model | undefined {
		return Players.LocalPlayer.Character;
	}

	public onCharacterAdded(callback: (character: Model) => void): RBXScriptConnection {
		return Players.LocalPlayer.CharacterAdded.Connect(callback);
	}

	public onCharacterRemoving(callback: (character: Model) => void): RBXScriptConnection {
		return Players.LocalPlayer.CharacterRemoving.Connect(callback);
	}
}

export interface CoreHealthVisibility {
	hide(): void;
	restore(): void;
}

export class RobloxCoreHealthVisibility implements CoreHealthVisibility {
	private generation = 0;
	private previousEnabled?: boolean;

	public hide(): void {
		const generation = ++this.generation;
		task.spawn(() => {
			for (let attempt = 0; attempt < CORE_GUI_RETRY_ATTEMPTS; attempt++) {
				if (this.generation !== generation) return;
				let enabled = false;
				const [readSucceeded] = pcall(() => {
					enabled = StarterGui.GetCoreGuiEnabled(Enum.CoreGuiType.Health);
				});
				if (readSucceeded) {
					if (this.previousEnabled === undefined) this.previousEnabled = enabled;
					const [writeSucceeded] = pcall(() => StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Health, false));
					if (writeSucceeded) return;
				}
				task.wait(CORE_GUI_RETRY_SECONDS);
			}
			warn("[PlayerResources] Unable to hide Roblox's native health UI.");
		});
	}

	public restore(): void {
		this.generation += 1;
		const previous = this.previousEnabled;
		this.previousEnabled = undefined;
		if (previous !== undefined) {
			pcall(() => StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Health, previous));
		}
	}
}

export class PlayerResourceController {
	private readonly lifecycleConnections = new Array<RBXScriptConnection>();
	private readonly humanoidConnections = new Array<RBXScriptConnection>();
	private characterChildConnection?: RBXScriptConnection;
	private snapshot: PlayerResourceSnapshot = createInitialPlayerResourceSnapshot();
	private characterGeneration = 0;
	private started = false;

	public constructor(
		private readonly hud: PlayerResourceHud,
		private readonly characterSource: CharacterResourceSource = new RobloxCharacterResourceSource(),
		private readonly coreHealthVisibility: CoreHealthVisibility = new RobloxCoreHealthVisibility(),
	) {}

	public start(): void {
		if (this.started) return;
		this.started = true;
		this.hud.render(this.snapshot);
		this.coreHealthVisibility.hide();
		this.lifecycleConnections.push(
			this.characterSource.onCharacterAdded((character) => this.bindCharacter(character)),
			this.characterSource.onCharacterRemoving((character) => {
				const current = this.characterSource.getCharacter();
				if (current === character || current === undefined) this.bindCharacter(undefined);
			}),
		);
		this.bindCharacter(this.characterSource.getCharacter());
	}

	public stop(): void {
		if (!this.started) return;
		this.started = false;
		this.characterGeneration += 1;
		for (const connection of this.lifecycleConnections) connection.Disconnect();
		this.lifecycleConnections.clear();
		this.clearCharacterConnections();
		this.coreHealthVisibility.restore();
	}

	public setStamina(current: number, maximum = this.snapshot.stamina.maximum): void {
		this.snapshot = { ...this.snapshot, stamina: normalizePlayerResource(current, maximum) };
		this.hud.render(this.snapshot);
	}

	public setMagic(current: number, maximum = this.snapshot.magic.maximum): void {
		this.snapshot = { ...this.snapshot, magic: normalizePlayerResource(current, maximum) };
		this.hud.render(this.snapshot);
	}

	public getSnapshot(): PlayerResourceSnapshot {
		return this.snapshot;
	}

	private bindCharacter(character: Model | undefined): void {
		const generation = ++this.characterGeneration;
		this.clearCharacterConnections();
		if (character === undefined) {
			this.updateHealth(0, 100);
			return;
		}

		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (humanoid !== undefined) {
			this.bindHumanoid(character, humanoid, generation);
			return;
		}
		this.updateHealth(0, 100);
		this.characterChildConnection = character.ChildAdded.Connect((child) => {
			if (
				this.started &&
				this.characterGeneration === generation &&
				this.characterSource.getCharacter() === character &&
				child.IsA("Humanoid")
			) {
				this.bindHumanoid(character, child, generation);
			}
		});
	}

	private bindHumanoid(character: Model, humanoid: Humanoid, generation: number): void {
		if (
			!this.started ||
			this.characterGeneration !== generation ||
			this.characterSource.getCharacter() !== character
		) {
			return;
		}
		this.characterChildConnection?.Disconnect();
		this.characterChildConnection = undefined;
		for (const connection of this.humanoidConnections) connection.Disconnect();
		this.humanoidConnections.clear();
		const refresh = () => {
			if (this.characterGeneration === generation && this.characterSource.getCharacter() === character) {
				this.updateHealth(humanoid.Health, humanoid.MaxHealth);
			}
		};
		this.humanoidConnections.push(
			humanoid.HealthChanged.Connect(refresh),
			humanoid.GetPropertyChangedSignal("MaxHealth").Connect(refresh),
			humanoid.AncestryChanged.Connect((_instance, parent) => {
				if (parent === undefined && this.characterSource.getCharacter() === character)
					this.bindCharacter(character);
			}),
		);
		refresh();
	}

	private updateHealth(current: number, maximum: number): void {
		this.snapshot = { ...this.snapshot, health: normalizePlayerResource(current, maximum) };
		this.hud.render(this.snapshot);
	}

	private clearCharacterConnections(): void {
		this.characterChildConnection?.Disconnect();
		this.characterChildConnection = undefined;
		for (const connection of this.humanoidConnections) connection.Disconnect();
		this.humanoidConnections.clear();
	}
}
