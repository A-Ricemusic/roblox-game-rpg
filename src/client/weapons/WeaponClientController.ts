import { ContextActionService, Players, ReplicatedStorage, UserInputService, Workspace } from "@rbxts/services";
import { MAX_WEAPON_ACTION_ID, parseLightSwingAccepted } from "shared/weapons/WeaponActionProtocol";
import {
	advanceLightCombo,
	LIGHT_COMBO_MINIMUM_INTERVALS,
	LightComboState,
	LightComboStep,
} from "shared/weapons/LightCombo";
import {
	EQUIPPED_WEAPON_NAME,
	WEAPON_ACTION_REMOTE_NAME,
	WEAPON_REMOTE_FOLDER_NAME,
} from "shared/weapons/WeaponConstants";
import { ProceduralSwordAnimator } from "./ProceduralSwordAnimator";

const LIGHT_SWING_ACTION = "HopliteSwordLightSwing";
const COMBAT_INPUT_PRIORITY = 2_500;
const PREDICTION_EXPIRY_SECONDS = 2.5;

interface PendingPrediction {
	readonly step: LightComboStep;
	readonly sentAt: number;
}

export class WeaponClientController {
	private animator?: ProceduralSwordAnimator;
	private remoteConnection?: RBXScriptConnection;
	private characterConnection?: RBXScriptConnection;
	private actionRemote?: RemoteEvent;
	private nextActionId = 0;
	private nextLocalSwingAt = 0;
	private predictedCombo?: LightComboState;
	private readonly predictedStepsByActionId = new Map<number, PendingPrediction>();
	private started = false;

	public constructor(private readonly canRequestAttack: () => boolean = () => true) {}

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
		this.characterConnection = Players.LocalPlayer.CharacterAdded.Connect((character) => {
			this.resetPrediction();
			this.animator?.registerCharacter(character);
		});
		const currentCharacter = Players.LocalPlayer.Character;
		if (currentCharacter !== undefined) this.animator.registerCharacter(currentCharacter);
		this.remoteConnection = remoteCandidate.OnClientEvent.Connect(
			(kind: unknown, actor: unknown, actionId: unknown, startedAt: unknown, comboStep: unknown) =>
				this.handleAcceptedSwing(kind, actor, actionId, startedAt, comboStep),
		);

		ContextActionService.BindActionAtPriority(
			LIGHT_SWING_ACTION,
			(_actionName, inputState) => {
				if (!this.canRequestAttack()) return Enum.ContextActionResult.Sink;
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
		this.characterConnection?.Disconnect();
		this.characterConnection = undefined;
		this.actionRemote = undefined;
		this.animator?.destroy();
		this.animator = undefined;
		this.resetPrediction();
	}

	private requestLightSwing(): boolean {
		if (!this.canRequestAttack()) return false;
		const character = Players.LocalPlayer.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		const now = Workspace.GetServerTimeNow();
		this.expireStalePredictions(now);
		if (
			character === undefined ||
			humanoid === undefined ||
			humanoid.Health <= 0 ||
			character.FindFirstChild(EQUIPPED_WEAPON_NAME) === undefined ||
			now < this.nextLocalSwingAt
		) {
			return false;
		}

		const advance = advanceLightCombo(this.predictedCombo, now);
		if (this.animator?.playLightSwing(character, now, advance.step) !== true) {
			return false;
		}
		this.predictedCombo = advance.state;
		this.nextLocalSwingAt = now + LIGHT_COMBO_MINIMUM_INTERVALS[advance.step];
		this.nextActionId = this.nextActionId >= MAX_WEAPON_ACTION_ID ? 0 : this.nextActionId + 1;
		this.predictedStepsByActionId.set(this.nextActionId, { step: advance.step, sentAt: now });
		this.actionRemote?.FireServer({ kind: "LightSwing", actionId: this.nextActionId });
		return true;
	}

	private handleAcceptedSwing(
		kind: unknown,
		actor: unknown,
		actionId: unknown,
		startedAt: unknown,
		comboStep: unknown,
	): void {
		const accepted = parseLightSwingAccepted(kind, actor, actionId, startedAt, comboStep);
		if (accepted === undefined) {
			return;
		}
		if (accepted.actor === Players.LocalPlayer) {
			const prediction = this.predictedStepsByActionId.get(accepted.actionId);
			this.predictedStepsByActionId.delete(accepted.actionId);
			if (prediction?.step !== accepted.comboStep) {
				const character = accepted.actor.Character;
				if (character !== undefined)
					this.animator?.playLightSwing(character, accepted.startedAt, accepted.comboStep);
			}
			return;
		}

		const character = accepted.actor.Character;
		if (character !== undefined) {
			this.animator?.playLightSwing(character, accepted.startedAt, accepted.comboStep);
		}
	}

	private expireStalePredictions(now: number): void {
		for (const [, prediction] of this.predictedStepsByActionId) {
			if (now - prediction.sentAt > PREDICTION_EXPIRY_SECONDS) {
				this.resetPrediction();
				return;
			}
		}
	}

	private resetPrediction(): void {
		this.nextLocalSwingAt = 0;
		this.predictedCombo = undefined;
		this.predictedStepsByActionId.clear();
	}
}
