import { Players, ReplicatedStorage, Workspace } from "@rbxts/services";
import { parseWeaponActionRequest } from "shared/weapons/WeaponActionProtocol";
import { WEAPON_ACTION_REMOTE_NAME, WEAPON_REMOTE_FOLDER_NAME } from "shared/weapons/WeaponConstants";
import { equipSword, findStarterSwordTemplate, hasEquippedStarterSword } from "./SwordEquipService";
import { WeaponActionGate } from "./WeaponActionGate";
import { getOrCreateFolder, getOrCreateRemoteEvent } from "server/remotes/RemoteInstanceFactory";

export class WeaponRuntime {
	private readonly actionGate = new WeaponActionGate();
	private readonly characterConnections = new Map<Player, RBXScriptConnection>();
	private readonly runtimeConnections = new Array<RBXScriptConnection>();
	private actionRemote?: RemoteEvent;

	public start(): void {
		if (this.actionRemote !== undefined) {
			return;
		}

		const remoteFolder = getOrCreateFolder(ReplicatedStorage, WEAPON_REMOTE_FOLDER_NAME);
		this.actionRemote = getOrCreateRemoteEvent(remoteFolder, WEAPON_ACTION_REMOTE_NAME);
		this.runtimeConnections.push(
			Players.PlayerAdded.Connect((player) => this.registerPlayer(player)),
			Players.PlayerRemoving.Connect((player) => this.unregisterPlayer(player)),
			this.actionRemote.OnServerEvent.Connect((player, payload: unknown) => this.handleAction(player, payload)),
		);

		for (const player of Players.GetPlayers()) {
			this.registerPlayer(player);
		}
	}

	public stop(): void {
		for (const connection of this.runtimeConnections) {
			connection.Disconnect();
		}
		this.runtimeConnections.clear();

		for (const [, connection] of this.characterConnections) {
			connection.Disconnect();
		}
		this.characterConnections.clear();
		this.actionGate.clear();
		this.actionRemote = undefined;
	}

	private registerPlayer(player: Player): void {
		this.characterConnections.get(player)?.Disconnect();
		this.characterConnections.set(
			player,
			player.CharacterAdded.Connect((character) => this.handleCharacterAdded(player, character)),
		);

		const existingCharacter = player.Character;
		if (existingCharacter !== undefined) {
			task.defer(() => this.handleCharacterAdded(player, existingCharacter));
		}
	}

	private handleCharacterAdded(player: Player, character: Model): void {
		this.actionGate.forget(player.UserId);
		this.equipStarterSword(character);
	}

	private unregisterPlayer(player: Player): void {
		this.characterConnections.get(player)?.Disconnect();
		this.characterConnections.delete(player);
		this.actionGate.forget(player.UserId);
	}

	private equipStarterSword(character: Model): void {
		const template = findStarterSwordTemplate(ReplicatedStorage);
		if (template === undefined) {
			warn(
				"[WeaponRuntime] Missing ReplicatedStorage/Assets/Weapons/HopliteSword. " +
					"Keep the Studio sword at that exact path before pressing Play.",
			);
			return;
		}

		const result = equipSword(character, template);
		if (!result.success) {
			warn(`[WeaponRuntime] Unable to equip starter sword: ${result.message}`);
		}
	}

	private handleAction(player: Player, payload: unknown): void {
		const request = parseWeaponActionRequest(payload);
		if (request === undefined) {
			return;
		}

		const character = player.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		if (
			character === undefined ||
			humanoid === undefined ||
			humanoid.Health <= 0 ||
			!hasEquippedStarterSword(character)
		) {
			return;
		}

		const startedAt = Workspace.GetServerTimeNow();
		const comboStep = this.actionGate.tryLightSwing(player.UserId, startedAt);
		if (comboStep === undefined) {
			return;
		}

		this.actionRemote?.FireAllClients("LightSwingAccepted", player, request.actionId, startedAt, comboStep);
	}
}
