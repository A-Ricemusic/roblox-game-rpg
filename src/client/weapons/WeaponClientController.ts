import { ContextActionService, Players, ReplicatedStorage, UserInputService, Workspace } from "@rbxts/services";
import { MAX_WEAPON_ACTION_ID, parseLightSwingAccepted } from "shared/weapons/WeaponActionProtocol";
import {
	EQUIPPED_WEAPON_NAME,
	LIGHT_SWING_COOLDOWN_SECONDS,
	WEAPON_ACTION_REMOTE_NAME,
	WEAPON_REMOTE_FOLDER_NAME,
} from "shared/weapons/WeaponConstants";
import { ProceduralSwordAnimator } from "./ProceduralSwordAnimator";

const LIGHT_SWING_ACTION = "HopliteSwordLightSwing";
const COMBAT_INPUT_PRIORITY = 2_500;

export class WeaponClientController {
	private animator?: ProceduralSwordAnimator;
	private remoteConnection?: RBXScriptConnection;
	private actionRemote?: RemoteEvent;
	private nextActionId = 0;
	private nextLocalSwingAt = 0;
	private started = false;

	public start(): void {
		if (this.started) {
			return;
		}
		this.started = true;

		const remoteFolder = ReplicatedStorage.WaitForChild(WEAPON_REMOTE_FOLDER_NAME);
		assert(remoteFolder.IsA("Folder"), `${remoteFolder.GetFullName()} must be a Folder.`);
		const remoteCandidate = remoteFolder.WaitForChild(WEAPON_ACTION_REMOTE_NAME);
		if (!remoteCandidate.IsA("RemoteEvent")) {
			error(`${remoteCandidate.GetFullName()} must be a RemoteEvent.`);
		}
		this.actionRemote = remoteCandidate;
		this.animator = new ProceduralSwordAnimator();
		this.remoteConnection = remoteCandidate.OnClientEvent.Connect(
			(kind: unknown, actor: unknown, actionId: unknown, startedAt: unknown) =>
				this.handleAcceptedSwing(kind, actor, actionId, startedAt),
		);

		ContextActionService.BindActionAtPriority(
			LIGHT_SWING_ACTION,
			(_actionName, inputState) => {
				if (UserInputService.GetFocusedTextBox() !== undefined) {
					return Enum.ContextActionResult.Pass;
				}
				if (inputState === Enum.UserInputState.Begin) {
					return this.requestLightSwing() ? Enum.ContextActionResult.Sink : Enum.ContextActionResult.Pass;
				}
				return Enum.ContextActionResult.Sink;
			},
			true,
			COMBAT_INPUT_PRIORITY,
			Enum.UserInputType.MouseButton1,
			Enum.KeyCode.ButtonR2,
		);
		ContextActionService.SetTitle(LIGHT_SWING_ACTION, "Attack");
		ContextActionService.SetPosition(LIGHT_SWING_ACTION, UDim2.fromScale(0.78, 0.72));
	}

	public stop(): void {
		if (!this.started) {
			return;
		}
		this.started = false;
		ContextActionService.UnbindAction(LIGHT_SWING_ACTION);
		this.remoteConnection?.Disconnect();
		this.remoteConnection = undefined;
		this.actionRemote = undefined;
		this.animator?.destroy();
		this.animator = undefined;
		this.nextLocalSwingAt = 0;
	}

	private requestLightSwing(): boolean {
		const character = Players.LocalPlayer.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		const now = Workspace.GetServerTimeNow();
		if (
			character === undefined ||
			humanoid === undefined ||
			humanoid.Health <= 0 ||
			character.FindFirstChild(EQUIPPED_WEAPON_NAME) === undefined ||
			now < this.nextLocalSwingAt
		) {
			return false;
		}

		if (this.animator?.playLightSwing(character, now) !== true) {
			return false;
		}
		this.nextLocalSwingAt = now + LIGHT_SWING_COOLDOWN_SECONDS;
		this.nextActionId = this.nextActionId >= MAX_WEAPON_ACTION_ID ? 0 : this.nextActionId + 1;
		this.actionRemote?.FireServer({ kind: "LightSwing", actionId: this.nextActionId });
		return true;
	}

	private handleAcceptedSwing(kind: unknown, actor: unknown, actionId: unknown, startedAt: unknown): void {
		const accepted = parseLightSwingAccepted(kind, actor, actionId, startedAt);
		if (accepted === undefined || accepted.actor === Players.LocalPlayer) {
			return;
		}

		const character = accepted.actor.Character;
		if (character !== undefined) {
			this.animator?.playLightSwing(character, accepted.startedAt);
		}
	}
}
