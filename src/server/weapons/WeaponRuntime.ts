import { Players, ReplicatedStorage, Workspace } from "@rbxts/services";
import { parseWeaponActionRequest } from "shared/weapons/WeaponActionProtocol";
import {
	STARTER_WEAPON_ID,
	WEAPON_ACTION_REMOTE_NAME,
	WEAPON_REMOTE_FOLDER_NAME,
} from "shared/weapons/WeaponConstants";
import { equipSword, findStarterSwordTemplate, hasEquippedStarterSword, unequipSword } from "./SwordEquipService";
import { WeaponActionGate } from "./WeaponActionGate";
import { getOrCreateFolder, getOrCreateRemoteEvent } from "server/remotes/RemoteInstanceFactory";

export class WeaponRuntime {
	private static readonly EQUIPMENT_RETRY_ATTEMPTS = 20;
	private static readonly EQUIPMENT_RETRY_INTERVAL_SECONDS = 0.1;
	private readonly actionGate = new WeaponActionGate();
	private readonly characterConnections = new Map<Player, RBXScriptConnection>();
	private readonly materializationGenerationByPlayer = new Map<Player, number>();
	private readonly runtimeConnections = new Array<RBXScriptConnection>();
	private actionRemote?: RemoteEvent;

	public constructor(
		private readonly equippedWeaponForPlayer: (player: Player) => string | undefined = () => undefined,
	) {}

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
		this.materializationGenerationByPlayer.clear();
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
		task.defer(() => {
			if (player.Character !== character) return;
			this.syncPlayerEquipment(player, character);
		});
	}

	public syncPlayerEquipment(player: Player, character: Model | undefined = player.Character): boolean {
		this.actionGate.resetCombo(player.UserId);
		const generation = (this.materializationGenerationByPlayer.get(player) ?? 0) + 1;
		this.materializationGenerationByPlayer.set(player, generation);
		if (character === undefined || player.Character !== character) return false;

		const materialized = this.applyPlayerEquipment(player, character, false);
		if (!materialized && this.equippedWeaponForPlayer(player) === STARTER_WEAPON_ID) {
			task.spawn(() => {
				for (let attempt = 1; attempt < WeaponRuntime.EQUIPMENT_RETRY_ATTEMPTS; attempt++) {
					task.wait(WeaponRuntime.EQUIPMENT_RETRY_INTERVAL_SECONDS);
					if (
						this.materializationGenerationByPlayer.get(player) !== generation ||
						player.Character !== character
					) {
						return;
					}
					if (this.applyPlayerEquipment(player, character, false)) return;
				}
				this.applyPlayerEquipment(player, character, true);
			});
		}
		return materialized;
	}

	private unregisterPlayer(player: Player): void {
		this.characterConnections.get(player)?.Disconnect();
		this.characterConnections.delete(player);
		this.materializationGenerationByPlayer.delete(player);
		this.actionGate.forget(player.UserId);
	}

	private applyPlayerEquipment(player: Player, character: Model, reportFailure: boolean): boolean {
		const weaponId = this.equippedWeaponForPlayer(player);
		if (weaponId === undefined) {
			unequipSword(character);
			return true;
		}
		if (weaponId !== STARTER_WEAPON_ID) {
			unequipSword(character);
			if (reportFailure) warn(`[WeaponRuntime] Unsupported equipped weapon '${weaponId}'.`);
			return false;
		}
		if (hasEquippedStarterSword(character)) return true;
		return this.equipStarterSword(character, reportFailure);
	}

	private equipStarterSword(character: Model, reportFailure: boolean): boolean {
		const template = findStarterSwordTemplate(ReplicatedStorage);
		if (template === undefined) {
			if (reportFailure)
				warn(
					"[WeaponRuntime] Missing ReplicatedStorage/Assets/Weapons/HopliteSword. " +
						"Keep the Studio sword at that exact path before pressing Play.",
				);
			return false;
		}

		const result = equipSword(character, template);
		if (!result.success) {
			if (reportFailure) warn(`[WeaponRuntime] Unable to equip starter sword: ${result.message}`);
			return false;
		}
		return true;
	}

	private handleAction(player: Player, payload: unknown): void {
		const request = parseWeaponActionRequest(payload);
		if (request === undefined) {
			return;
		}

		const character = player.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		if (
			this.equippedWeaponForPlayer(player) !== STARTER_WEAPON_ID ||
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
