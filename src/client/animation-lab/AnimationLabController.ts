import { CaptureService, Players, RunService, Workspace } from "@rbxts/services";
import { evaluateMotionTrajectory, TrajectorySample } from "shared/animation-lab/MotionDiagnostics";
import { LightComboStep } from "shared/weapons/LightCombo";
import { getLightComboMotionDuration } from "shared/weapons/SwordMotion";
import { EQUIPPED_WEAPON_NAME } from "shared/weapons/WeaponConstants";
import { ProceduralSwordAnimator } from "../weapons/ProceduralSwordAnimator";
import { TrajectoryVisualizer } from "./TrajectoryVisualizer";

const PLAYBACK_SPEED = 0.45;
const AUTO_HOLD_SECONDS = 0.8;
const LAB_GUI_NAME = "AnimationLab";

type CameraView = "Front" | "Side" | "Rear" | "ThreeQuarter";

const CAMERA_OFFSETS: Readonly<Record<CameraView, Vector3>> = {
	Front: new Vector3(0, 2.4, -14),
	Side: new Vector3(14, 2.4, 0),
	Rear: new Vector3(0, 2.4, 14),
	ThreeQuarter: new Vector3(10, 3, -10),
};

function makeLabel(parent: Instance, text: string, size: UDim2, position: UDim2, textSize = 16): TextLabel {
	const label = new Instance("TextLabel");
	label.BackgroundTransparency = 1;
	label.Font = Enum.Font.Gotham;
	label.Text = text;
	label.TextColor3 = Color3.fromRGB(235, 238, 245);
	label.TextSize = textSize;
	label.TextXAlignment = Enum.TextXAlignment.Left;
	label.Size = size;
	label.Position = position;
	label.Parent = parent;
	return label;
}

function makeButton(parent: Instance, text: string, position: UDim2, width = 82): TextButton {
	const button = new Instance("TextButton");
	button.AutoButtonColor = true;
	button.BackgroundColor3 = Color3.fromRGB(47, 58, 78);
	button.BorderSizePixel = 0;
	button.Font = Enum.Font.GothamMedium;
	button.Text = text;
	button.TextColor3 = Color3.fromRGB(245, 247, 252);
	button.TextSize = 14;
	button.Size = UDim2.fromOffset(width, 34);
	button.Position = position;
	button.Parent = parent;
	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, 6);
	corner.Parent = button;
	return button;
}

function getTipAttachment(character: Model): Attachment | undefined {
	const weapon = character.FindFirstChild(EQUIPPED_WEAPON_NAME);
	const tip = weapon?.FindFirstChild("Tip", true);
	return tip?.IsA("Attachment") === true ? tip : undefined;
}

export class AnimationLabController {
	private readonly animator = new ProceduralSwordAnimator();
	private readonly trajectory = new TrajectoryVisualizer();
	private readonly connections = new Array<RBXScriptConnection>();
	private renderConnection?: RBXScriptConnection;
	private readonly samples = new Array<TrajectorySample>();
	private readonly hiddenGuis = new Map<ScreenGui, boolean>();
	private character?: Model;
	private root?: BasePart;
	private torso?: BasePart;
	private tip?: Attachment;
	private gui?: ScreenGui;
	private titleLabel?: TextLabel;
	private timeLabel?: TextLabel;
	private reportLabel?: TextLabel;
	private timelineFill?: Frame;
	private captureImage?: ImageLabel;
	private captureCaption?: TextLabel;
	private step: LightComboStep = 1;
	private elapsedSeconds = 0;
	private holdSeconds = 0;
	private cameraView: CameraView = "ThreeQuarter";
	private playing = true;
	private autoCycle = true;
	private started = false;
	private captureTaken = false;

	public start(): void {
		if (this.started || !RunService.IsStudio() || Workspace.GetAttribute("AnimationLabDisabled") === true) return;
		this.started = true;
		task.spawn(() => this.attachToCharacter());
		this.connections.push(
			Players.LocalPlayer.CharacterAdded.Connect(() => task.spawn(() => this.attachToCharacter())),
		);
	}

	public destroy(): void {
		if (!this.started) return;
		this.started = false;
		for (const connection of this.connections) connection.Disconnect();
		this.connections.clear();
		this.renderConnection?.Disconnect();
		this.renderConnection = undefined;
		this.animator.destroy();
		this.trajectory.destroy();
		this.gui?.Destroy();
		for (const [gui, wasEnabled] of this.hiddenGuis) {
			if (gui.Parent !== undefined) gui.Enabled = wasEnabled;
		}
		this.hiddenGuis.clear();
		this.restoreCharacter();
	}

	private attachToCharacter(): void {
		const character = Players.LocalPlayer.Character ?? Players.LocalPlayer.CharacterAdded.Wait()[0];
		const root = character.WaitForChild("HumanoidRootPart", 10);
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (root === undefined || !root.IsA("BasePart") || humanoid === undefined) return;
		const torso = character.FindFirstChild("UpperTorso") ?? character.FindFirstChild("Torso");
		if (torso === undefined || !torso.IsA("BasePart")) return;

		this.restoreCharacter();
		this.character = character;
		this.root = root;
		this.torso = torso;
		humanoid.WalkSpeed = 0;
		humanoid.AutoRotate = false;
		root.Anchored = true;
		this.tip = this.waitForTip(character);
		this.createGui();
		this.restartStep();
		this.renderConnection?.Disconnect();
		this.renderConnection = RunService.RenderStepped.Connect((deltaTime) => this.update(deltaTime));
		print("[AnimationLab] Autonomous review loop started in the current Studio place.");
	}

	private waitForTip(character: Model): Attachment | undefined {
		for (let attempt = 0; attempt < 100; attempt++) {
			const tip = getTipAttachment(character);
			if (tip !== undefined) return tip;
			task.wait(0.05);
		}
		warn("[AnimationLab] Equipped sword has no Tip attachment; trajectory diagnostics are unavailable.");
		return undefined;
	}

	private restoreCharacter(): void {
		const previousCharacter = this.character;
		if (previousCharacter !== undefined) this.animator.clearCharacter(previousCharacter);
		const humanoid = previousCharacter?.FindFirstChildOfClass("Humanoid");
		if (humanoid !== undefined) {
			humanoid.WalkSpeed = 16;
			humanoid.AutoRotate = true;
		}
		if (this.root !== undefined) this.root.Anchored = false;
		this.character = undefined;
		this.root = undefined;
		this.torso = undefined;
		this.tip = undefined;
	}

	private update(deltaTime: number): void {
		const character = this.character;
		const root = this.root;
		const torso = this.torso;
		if (character === undefined || root === undefined || torso === undefined || character.Parent === undefined)
			return;

		this.updateCamera(root);
		const duration = getLightComboMotionDuration(this.step);
		if (this.playing) {
			this.elapsedSeconds = math.min(duration, this.elapsedSeconds + deltaTime * PLAYBACK_SPEED);
			if (this.elapsedSeconds >= duration) {
				this.holdSeconds += deltaTime;
				if (this.autoCycle && this.holdSeconds >= AUTO_HOLD_SECONDS) this.nextStep();
			}
		}

		this.animator.previewLightSwing(character, this.step, this.elapsedSeconds);
		if (!this.captureTaken && this.elapsedSeconds >= duration * 0.55) this.captureStrikeFrame();
		const tip = this.tip;
		if (tip !== undefined && this.playing && this.elapsedSeconds < duration) {
			this.trajectory.add(tip.WorldPosition);
			this.samples.push({
				elapsedSeconds: this.elapsedSeconds,
				tipPosition: tip.WorldPosition,
				torsoPosition: torso.Position,
			});
		}
		this.updateGui(duration);
	}

	private updateCamera(root: BasePart): void {
		const camera = Workspace.CurrentCamera;
		if (camera === undefined) return;
		const focus = root.Position.add(new Vector3(0, 1.6, 0));
		const offset = root.CFrame.VectorToWorldSpace(CAMERA_OFFSETS[this.cameraView]);
		camera.CameraType = Enum.CameraType.Scriptable;
		camera.CFrame = CFrame.lookAt(focus.add(offset), focus);
		camera.FieldOfView = 48;
	}

	private restartStep(): void {
		this.elapsedSeconds = 0;
		this.holdSeconds = 0;
		this.playing = true;
		this.samples.clear();
		this.trajectory.clear();
		this.captureTaken = false;
		if (this.reportLabel !== undefined) this.reportLabel.Text = "Recording sword-tip trajectory…";
	}

	private captureStrikeFrame(): void {
		this.captureTaken = true;
		const capturedStep = this.step;
		const labGui = this.gui;
		if (labGui !== undefined) labGui.Enabled = false;
		task.defer(() => {
			const [success, message] = pcall(() =>
				CaptureService.CaptureScreenshot((contentId) => {
					if (labGui !== undefined) labGui.Enabled = true;
					if (this.captureImage !== undefined) this.captureImage.Image = contentId;
					if (this.captureCaption !== undefined)
						this.captureCaption.Text = `AUTOCAPTURE · ATTACK ${capturedStep} · 55% CONTACT FRAME`;
					print(`[AnimationLab] Captured Attack ${capturedStep} contact frame: ${contentId}`);
				}),
			);
			if (!success) {
				if (labGui !== undefined) labGui.Enabled = true;
				warn(`[AnimationLab] Contact-frame capture failed: ${message}`);
			}
		});
	}

	private finishReport(): void {
		const root = this.root;
		if (root === undefined || this.reportLabel === undefined) return;
		const report = evaluateMotionTrajectory(this.step, root.CFrame, this.samples);
		const issueText = report.issues.isEmpty() ? "PASS: structural checks" : `FAIL: ${report.issues.join(" · ")}`;
		this.reportLabel.Text = `${issueText}\nTravel X ${string.format("%.2f", report.horizontalTravel)}  Y ${string.format("%.2f", report.verticalTravel)}  Z ${string.format("%.2f", report.forwardTravel)}  Clearance ${string.format("%.2f", report.minimumTorsoClearance)}`;
		print(`[AnimationLab] Attack ${this.step}: ${this.reportLabel.Text}`);
	}

	private nextStep(): void {
		this.finishReport();
		this.step = this.step === 4 ? 1 : ((this.step + 1) as LightComboStep);
		this.restartStep();
	}

	private selectStep(step: LightComboStep): void {
		this.step = step;
		this.autoCycle = false;
		this.restartStep();
	}

	private scrub(alpha: number): void {
		this.autoCycle = false;
		this.playing = false;
		this.elapsedSeconds = getLightComboMotionDuration(this.step) * alpha;
		this.holdSeconds = 0;
	}

	private updateGui(duration: number): void {
		const alpha = duration > 0 ? this.elapsedSeconds / duration : 0;
		if (this.titleLabel !== undefined)
			this.titleLabel.Text = `ANIMATION LAB  ·  ATTACK ${this.step}  ·  ${string.upper(this.cameraView)}`;
		if (this.timeLabel !== undefined)
			this.timeLabel.Text = `${string.format("%.3f", this.elapsedSeconds)}s / ${string.format("%.3f", duration)}s  ·  ${string.format("%.0f", alpha * 100)}%  ·  ${this.autoCycle ? "AUTO" : this.playing ? "PLAY" : "PAUSED"}`;
		if (this.timelineFill !== undefined) this.timelineFill.Size = UDim2.fromScale(math.clamp(alpha, 0, 1), 1);
	}

	private createGui(): void {
		this.gui?.Destroy();
		const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
		for (const child of playerGui.GetChildren()) {
			if (child.IsA("ScreenGui") && child.Name !== LAB_GUI_NAME) {
				this.hiddenGuis.set(child, child.Enabled);
				child.Enabled = false;
			}
		}
		const gui = new Instance("ScreenGui");
		gui.Name = LAB_GUI_NAME;
		gui.ResetOnSpawn = false;
		gui.IgnoreGuiInset = true;
		gui.DisplayOrder = 100;
		gui.Parent = playerGui;
		this.gui = gui;

		const panel = new Instance("Frame");
		panel.AnchorPoint = new Vector2(1, 1);
		panel.Position = UDim2.fromScale(0.985, 0.97);
		panel.Size = new UDim2(0, 680, 0, 190);
		panel.BackgroundColor3 = Color3.fromRGB(20, 25, 36);
		panel.BackgroundTransparency = 0.08;
		panel.BorderSizePixel = 0;
		panel.Parent = gui;
		const panelCorner = new Instance("UICorner");
		panelCorner.CornerRadius = new UDim(0, 10);
		panelCorner.Parent = panel;

		this.titleLabel = makeLabel(panel, "ANIMATION LAB", new UDim2(1, -30, 0, 28), UDim2.fromOffset(16, 10), 18);
		this.titleLabel.Font = Enum.Font.GothamBold;
		this.timeLabel = makeLabel(panel, "", new UDim2(1, -30, 0, 22), UDim2.fromOffset(16, 38), 13);

		const track = new Instance("Frame");
		track.BackgroundColor3 = Color3.fromRGB(57, 65, 82);
		track.BorderSizePixel = 0;
		track.Position = UDim2.fromOffset(16, 64);
		track.Size = new UDim2(1, -32, 0, 8);
		track.Parent = panel;
		const fill = new Instance("Frame");
		fill.BackgroundColor3 = Color3.fromRGB(240, 174, 45);
		fill.BorderSizePixel = 0;
		fill.Size = UDim2.fromScale(0, 1);
		fill.Parent = track;
		this.timelineFill = fill;

		for (const step of [1, 2, 3, 4] as const) {
			makeButton(panel, `Attack ${step}`, UDim2.fromOffset(16 + (step - 1) * 92, 84)).Activated.Connect(() =>
				this.selectStep(step),
			);
		}
		makeButton(panel, "Auto", UDim2.fromOffset(390, 84), 60).Activated.Connect(() => {
			this.autoCycle = true;
			this.restartStep();
		});
		makeButton(panel, "Pause", UDim2.fromOffset(458, 84), 74).Activated.Connect(() => {
			this.autoCycle = false;
			this.playing = !this.playing;
		});
		makeButton(panel, "Restart", UDim2.fromOffset(540, 84), 64).Activated.Connect(() => this.restartStep());
		makeButton(panel, "Next", UDim2.fromOffset(612, 84), 52).Activated.Connect(() => this.nextStep());

		const scrubPoints = [0, 0.25, 0.5, 0.75, 1];
		for (let index = 0; index < scrubPoints.size(); index++) {
			const alpha = scrubPoints[index];
			makeButton(panel, `${alpha * 100}%`, UDim2.fromOffset(16 + index * 58, 126), 50).Activated.Connect(() =>
				this.scrub(alpha),
			);
		}
		const cameraViews: ReadonlyArray<CameraView> = ["Front", "Side", "Rear", "ThreeQuarter"];
		for (let index = 0; index < cameraViews.size(); index++) {
			const view = cameraViews[index];
			makeButton(
				panel,
				view === "ThreeQuarter" ? "3/4" : view,
				UDim2.fromOffset(326 + index * 82, 126),
				74,
			).Activated.Connect(() => (this.cameraView = view));
		}

		this.reportLabel = makeLabel(
			panel,
			"Recording sword-tip trajectory…",
			new UDim2(1, -30, 0, 38),
			UDim2.fromOffset(16, 162),
			12,
		);
		this.reportLabel.TextColor3 = Color3.fromRGB(182, 198, 225);
		this.reportLabel.TextWrapped = true;

		const captureCard = new Instance("Frame");
		captureCard.BackgroundColor3 = Color3.fromRGB(20, 25, 36);
		captureCard.BackgroundTransparency = 0.08;
		captureCard.BorderSizePixel = 0;
		captureCard.Position = UDim2.fromOffset(18, 18);
		captureCard.Size = UDim2.fromOffset(290, 202);
		captureCard.Parent = gui;
		const captureCorner = new Instance("UICorner");
		captureCorner.CornerRadius = new UDim(0, 10);
		captureCorner.Parent = captureCard;
		const image = new Instance("ImageLabel");
		image.BackgroundColor3 = Color3.fromRGB(10, 12, 18);
		image.BorderSizePixel = 0;
		image.Position = UDim2.fromOffset(10, 10);
		image.Size = UDim2.fromOffset(270, 152);
		image.ScaleType = Enum.ScaleType.Fit;
		image.Parent = captureCard;
		this.captureImage = image;
		const caption = makeLabel(
			captureCard,
			"Waiting for automatic contact-frame capture…",
			new UDim2(1, -20, 0, 30),
			UDim2.fromOffset(10, 168),
			11,
		);
		caption.TextWrapped = true;
		caption.TextColor3 = Color3.fromRGB(240, 174, 45);
		this.captureCaption = caption;
	}
}
