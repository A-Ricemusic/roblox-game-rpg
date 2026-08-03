import { QuestClientView } from "shared/quests/QuestTypes";

const COLORS = {
	ink: Color3.fromRGB(24, 31, 45),
	navy: Color3.fromRGB(30, 43, 67),
	gold: Color3.fromRGB(218, 176, 77),
	parchment: Color3.fromRGB(241, 229, 198),
	muted: Color3.fromRGB(176, 181, 190),
	track: Color3.fromRGB(60, 69, 85),
} as const;

const HUD_LAYOUT = {
	rightMargin: 16,
	// Roblox notifications and voice/chat controls use the upper-right corner. Keep the
	// quest panel below that transient Core UI lane instead of merely clearing the topbar.
	topCoreUiLane: 136,
	widthScale: 0.3,
	minimumWidth: 280,
	maximumWidth: 360,
} as const;

function addCorner(parent: GuiObject, radius = 8): void {
	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, radius);
	corner.Parent = parent;
}

function addPadding(parent: GuiObject, horizontal: number, vertical: number): void {
	const padding = new Instance("UIPadding");
	padding.PaddingLeft = new UDim(0, horizontal);
	padding.PaddingRight = new UDim(0, horizontal);
	padding.PaddingTop = new UDim(0, vertical);
	padding.PaddingBottom = new UDim(0, vertical);
	padding.Parent = parent;
}

function createText(parent: Instance, name: string, text: string, height: number, font: Enum.Font): TextLabel {
	const label = new Instance("TextLabel");
	label.Name = name;
	label.AutomaticSize = Enum.AutomaticSize.Y;
	label.BackgroundTransparency = 1;
	label.Font = font;
	label.Size = new UDim2(1, 0, 0, height);
	label.Text = text;
	label.TextColor3 = COLORS.parchment;
	label.TextSize = 15;
	label.TextWrapped = true;
	label.TextXAlignment = Enum.TextXAlignment.Left;
	label.Parent = parent;
	return label;
}

export class QuestHud {
	private readonly screenGui = new Instance("ScreenGui");
	private readonly panel = new Instance("Frame");
	private readonly content = new Instance("Frame");
	private readonly countLabel: TextLabel;

	public constructor(parent: Instance) {
		this.screenGui.Name = "QuestHud";
		this.screenGui.ClipToDeviceSafeArea = true;
		this.screenGui.DisplayOrder = 20;
		this.screenGui.ResetOnSpawn = false;
		this.screenGui.SafeAreaCompatibility = Enum.SafeAreaCompatibility.None;
		this.screenGui.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets;
		this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		this.screenGui.Parent = parent;

		this.panel.Name = "QuestPanel";
		this.panel.AnchorPoint = new Vector2(1, 0);
		this.panel.AutomaticSize = Enum.AutomaticSize.Y;
		this.panel.BackgroundColor3 = COLORS.ink;
		this.panel.BackgroundTransparency = 0.08;
		this.panel.BorderSizePixel = 0;
		this.panel.Position = new UDim2(1, -HUD_LAYOUT.rightMargin, 0, HUD_LAYOUT.topCoreUiLane);
		this.panel.Size = new UDim2(HUD_LAYOUT.widthScale, 0, 0, 0);
		this.panel.Parent = this.screenGui;
		addCorner(this.panel, 10);
		addPadding(this.panel, 14, 12);

		const sizeConstraint = new Instance("UISizeConstraint");
		sizeConstraint.Name = "ResponsiveWidth";
		sizeConstraint.MinSize = new Vector2(HUD_LAYOUT.minimumWidth, 0);
		sizeConstraint.MaxSize = new Vector2(HUD_LAYOUT.maximumWidth, math.huge);
		sizeConstraint.Parent = this.panel;

		const panelLayout = new Instance("UIListLayout");
		panelLayout.Padding = new UDim(0, 8);
		panelLayout.SortOrder = Enum.SortOrder.LayoutOrder;
		panelLayout.Parent = this.panel;

		const eyebrow = createText(this.panel, "Eyebrow", "ODYSSEY", 18, Enum.Font.GothamBold);
		eyebrow.LayoutOrder = 1;
		eyebrow.TextColor3 = COLORS.gold;
		eyebrow.TextSize = 12;

		const header = createText(this.panel, "Header", "QUESTS", 26, Enum.Font.GothamBold);
		header.LayoutOrder = 2;
		header.TextSize = 22;

		this.countLabel = createText(this.panel, "QuestCount", "0 ACTIVE", 16, Enum.Font.GothamMedium);
		this.countLabel.LayoutOrder = 3;
		this.countLabel.TextColor3 = COLORS.muted;
		this.countLabel.TextSize = 11;

		const divider = new Instance("Frame");
		divider.Name = "Divider";
		divider.BackgroundColor3 = COLORS.gold;
		divider.BackgroundTransparency = 0.35;
		divider.BorderSizePixel = 0;
		divider.LayoutOrder = 4;
		divider.Size = new UDim2(1, 0, 0, 1);
		divider.Parent = this.panel;

		this.content.Name = "QuestContent";
		this.content.AutomaticSize = Enum.AutomaticSize.Y;
		this.content.BackgroundTransparency = 1;
		this.content.LayoutOrder = 5;
		this.content.Size = new UDim2(1, 0, 0, 0);
		this.content.Parent = this.panel;

		this.render([]);
	}

	public render(quests: ReadonlyArray<QuestClientView>): void {
		for (const child of this.content.GetChildren()) child.Destroy();

		const layout = new Instance("UIListLayout");
		layout.Padding = new UDim(0, 9);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = this.content;
		this.countLabel.Text = `${quests.size()} ACTIVE`;

		if (quests.size() === 0) {
			const empty = createText(this.content, "EmptyState", "No active quests", 34, Enum.Font.GothamMedium);
			empty.TextColor3 = COLORS.muted;
			empty.TextSize = 13;
			return;
		}

		for (let index = 0; index < quests.size(); index++) {
			this.createQuestCard(quests[index], index + 1);
		}
	}

	public destroy(): void {
		this.screenGui.Destroy();
	}

	public getRoot(): ScreenGui {
		return this.screenGui;
	}

	private createQuestCard(quest: QuestClientView, layoutOrder: number): void {
		const card = new Instance("Frame");
		card.Name = `Quest_${quest.questId}`;
		card.AutomaticSize = Enum.AutomaticSize.Y;
		card.BackgroundColor3 = COLORS.navy;
		card.BackgroundTransparency = 0.04;
		card.BorderSizePixel = 0;
		card.LayoutOrder = layoutOrder;
		card.Size = new UDim2(1, 0, 0, 0);
		card.Parent = this.content;
		addCorner(card, 7);
		addPadding(card, 11, 10);

		const layout = new Instance("UIListLayout");
		layout.Padding = new UDim(0, 6);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = card;

		const title = createText(card, "QuestTitle", quest.title, 22, Enum.Font.GothamBold);
		title.LayoutOrder = 1;
		title.TextSize = 16;

		const stage = createText(card, "StageTitle", quest.stageTitle, 18, Enum.Font.GothamMedium);
		stage.LayoutOrder = 2;
		stage.TextColor3 = COLORS.gold;
		stage.TextSize = 12;

		for (let index = 0; index < quest.objectives.size(); index++) {
			this.createObjective(card, quest.objectives[index], index + 3);
		}
	}

	private createObjective(
		parent: Frame,
		objective: QuestClientView["objectives"][number],
		layoutOrder: number,
	): void {
		const row = new Instance("Frame");
		row.Name = `Objective_${objective.id}`;
		row.AutomaticSize = Enum.AutomaticSize.Y;
		row.BackgroundTransparency = 1;
		row.LayoutOrder = layoutOrder;
		row.Size = new UDim2(1, 0, 0, 0);
		row.Parent = parent;

		const layout = new Instance("UIListLayout");
		layout.Padding = new UDim(0, 4);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = row;

		const progress = math.min(objective.required, math.max(0, objective.progress));
		const text = createText(
			row,
			"ObjectiveText",
			`${objective.description}  ${progress}/${objective.required}`,
			20,
			Enum.Font.Gotham,
		);
		text.LayoutOrder = 1;
		text.TextSize = 13;

		const track = new Instance("Frame");
		track.Name = "ProgressTrack";
		track.BackgroundColor3 = COLORS.track;
		track.BorderSizePixel = 0;
		track.ClipsDescendants = true;
		track.LayoutOrder = 2;
		track.Size = new UDim2(1, 0, 0, 6);
		track.Parent = row;
		addCorner(track, 3);

		const fill = new Instance("Frame");
		fill.Name = "ProgressFill";
		fill.BackgroundColor3 = COLORS.gold;
		fill.BorderSizePixel = 0;
		fill.Size = new UDim2(progress / objective.required, 0, 1, 0);
		fill.Parent = track;
		addCorner(fill, 3);
	}
}
