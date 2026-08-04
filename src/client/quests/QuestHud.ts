import { QuestClientView } from "shared/quests/QuestTypes";

import { addOdysseyCorner, addOdysseyPadding, createOdysseyText, ODYSSEY_COLORS } from "../ui/OdysseyUi";

export type QuestJournalFilter = "Active" | "All";

const TRACKER_POSITION = new UDim2(0, 18, 0, 136);
const TRACKER_WIDTH = 280;
const TRACKER_LIST_HEIGHT = 176;

function createButton(parent: Instance, name: string, text: string): TextButton {
	const button = new Instance("TextButton");
	button.Name = name;
	button.AutoButtonColor = true;
	button.BackgroundColor3 = ODYSSEY_COLORS.ink;
	button.BorderSizePixel = 0;
	button.Font = Enum.Font.GothamBold;
	button.Text = text;
	button.TextColor3 = ODYSSEY_COLORS.parchment;
	button.TextSize = 13;
	button.Parent = parent;
	addOdysseyCorner(button, 9);
	return button;
}

function addProgressBar(parent: Instance, progress: number, required: number, position: UDim2): void {
	const track = new Instance("Frame");
	track.Name = "ProgressTrack";
	track.BackgroundColor3 = ODYSSEY_COLORS.track;
	track.BorderSizePixel = 0;
	track.ClipsDescendants = true;
	track.Position = position;
	track.Size = new UDim2(1, 0, 0, 6);
	track.Parent = parent;
	addOdysseyCorner(track, 3);

	const fill = new Instance("Frame");
	fill.Name = "ProgressFill";
	fill.BackgroundColor3 = ODYSSEY_COLORS.gold;
	fill.BorderSizePixel = 0;
	fill.Size = new UDim2(math.clamp(progress / required, 0, 1), 0, 1, 0);
	fill.Parent = track;
	addOdysseyCorner(fill, 3);
}

export class QuestHud {
	private readonly root = new Instance("ScreenGui");
	private readonly tracker = new Instance("Frame");
	private readonly trackerToggle = createButton(this.tracker, "QuestTrackerToggle", "QUESTS (0)  +");
	private readonly trackerBody = new Instance("Frame");
	private readonly trackerCount: TextLabel;
	private readonly trackerList = new Instance("ScrollingFrame");
	private readonly moreQuestsButton = createButton(this.trackerBody, "MoreQuests", "MORE QUESTS");
	private readonly journalOverlay = new Instance("Frame");
	private readonly journalPanel = new Instance("Frame");
	private readonly journalClose = createButton(this.journalPanel, "QuestJournalClose", "×");
	private readonly activeTab = createButton(this.journalPanel, "ActiveQuestsTab", "ACTIVE");
	private readonly allTab = createButton(this.journalPanel, "AllQuestsTab", "ALL QUESTS");
	private readonly journalList = new Instance("ScrollingFrame");
	private readonly journalDetail = new Instance("ScrollingFrame");
	private quests: ReadonlyArray<QuestClientView> = [];
	private trackerExpanded = false;
	private journalOpen = false;
	private journalFilter: QuestJournalFilter = "Active";
	private selectedQuestId?: string;
	private beforeJournalOpen?: () => void;

	public constructor(parent: Instance) {
		this.root.Name = "QuestHud";
		this.root.ClipToDeviceSafeArea = true;
		this.root.DisplayOrder = 20;
		this.root.ResetOnSpawn = false;
		this.root.SafeAreaCompatibility = Enum.SafeAreaCompatibility.None;
		this.root.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets;
		this.root.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		this.root.Parent = parent;

		this.tracker.Name = "QuestTracker";
		this.tracker.AutomaticSize = Enum.AutomaticSize.Y;
		this.tracker.BackgroundTransparency = 1;
		this.tracker.Position = TRACKER_POSITION;
		this.tracker.Size = new UDim2(0, TRACKER_WIDTH, 0, 0);
		this.tracker.Parent = this.root;
		const trackerLayout = new Instance("UIListLayout");
		trackerLayout.Padding = new UDim(0, 8);
		trackerLayout.SortOrder = Enum.SortOrder.LayoutOrder;
		trackerLayout.Parent = this.tracker;

		this.trackerToggle.LayoutOrder = 1;
		this.trackerToggle.Size = new UDim2(0, 132, 0, 44);
		this.trackerToggle.TextXAlignment = Enum.TextXAlignment.Center;

		this.trackerBody.Name = "QuestTrackerBody";
		this.trackerBody.BackgroundColor3 = ODYSSEY_COLORS.ink;
		this.trackerBody.BackgroundTransparency = 0.04;
		this.trackerBody.BorderSizePixel = 0;
		this.trackerBody.LayoutOrder = 2;
		this.trackerBody.Size = new UDim2(1, 0, 0, 264);
		this.trackerBody.Visible = false;
		this.trackerBody.Parent = this.tracker;
		addOdysseyCorner(this.trackerBody, 10);
		addOdysseyPadding(this.trackerBody, 12, 10);

		this.trackerCount = createOdysseyText(this.trackerBody, "QuestCount", "0 ACTIVE", 11, Enum.Font.GothamBold);
		this.trackerCount.Position = new UDim2(0, 0, 0, 0);
		this.trackerCount.TextColor3 = ODYSSEY_COLORS.gold;

		this.trackerList.Name = "TrackerQuestList";
		this.trackerList.AutomaticCanvasSize = Enum.AutomaticSize.Y;
		this.trackerList.BackgroundTransparency = 1;
		this.trackerList.BorderSizePixel = 0;
		this.trackerList.CanvasSize = new UDim2();
		this.trackerList.Position = new UDim2(0, 0, 0, 24);
		this.trackerList.ScrollBarImageColor3 = ODYSSEY_COLORS.gold;
		this.trackerList.ScrollBarThickness = 4;
		this.trackerList.Size = new UDim2(1, 0, 0, TRACKER_LIST_HEIGHT);
		this.trackerList.Parent = this.trackerBody;

		this.moreQuestsButton.Position = new UDim2(0, 0, 1, -42);
		this.moreQuestsButton.Size = new UDim2(1, 0, 0, 38);
		this.moreQuestsButton.BackgroundColor3 = ODYSSEY_COLORS.navy;

		this.configureJournal();
		this.trackerToggle.Activated.Connect(() => this.setTrackerExpanded(!this.trackerExpanded));
		this.moreQuestsButton.Activated.Connect(() => this.setJournalOpen(true));
		this.journalClose.Activated.Connect(() => this.setJournalOpen(false));
		this.activeTab.Activated.Connect(() => this.setJournalFilter("Active"));
		this.allTab.Activated.Connect(() => this.setJournalFilter("All"));
		this.render([]);
	}

	public render(quests: ReadonlyArray<QuestClientView>): void {
		this.quests = quests;
		this.renderTracker();
		this.renderJournal();
	}

	public setTrackerExpanded(expanded: boolean): void {
		this.trackerExpanded = expanded;
		this.trackerBody.Visible = expanded;
		this.updateTrackerToggleText();
	}

	public isTrackerExpanded(): boolean {
		return this.trackerExpanded;
	}

	public setJournalOpen(open: boolean): void {
		if (open && !this.journalOpen) this.beforeJournalOpen?.();
		this.journalOpen = open;
		this.journalOverlay.Visible = open;
		if (open) {
			this.setTrackerExpanded(false);
			this.renderJournal();
		}
	}

	public setBeforeJournalOpen(callback: (() => void) | undefined): void {
		this.beforeJournalOpen = callback;
	}

	public isJournalOpen(): boolean {
		return this.journalOpen;
	}

	public setJournalFilter(filter: QuestJournalFilter): void {
		this.journalFilter = filter;
		this.renderJournal();
	}

	public getJournalFilter(): QuestJournalFilter {
		return this.journalFilter;
	}

	public selectQuest(questId: string): boolean {
		if (!this.filteredQuests().some((quest) => quest.questId === questId)) return false;
		this.selectedQuestId = questId;
		this.renderJournal();
		return true;
	}

	public getSelectedQuestId(): string | undefined {
		return this.selectedQuestId;
	}

	public getTrackerToggleButton(): TextButton {
		return this.trackerToggle;
	}

	public getMoreQuestsButton(): TextButton {
		return this.moreQuestsButton;
	}

	public getJournalCloseButton(): TextButton {
		return this.journalClose;
	}

	public getRoot(): ScreenGui {
		return this.root;
	}

	public destroy(): void {
		this.root.Destroy();
	}

	private configureJournal(): void {
		this.journalOverlay.Name = "QuestJournalOverlay";
		this.journalOverlay.Active = true;
		this.journalOverlay.BackgroundColor3 = ODYSSEY_COLORS.overlay;
		this.journalOverlay.BackgroundTransparency = 0.28;
		this.journalOverlay.BorderSizePixel = 0;
		this.journalOverlay.Size = UDim2.fromScale(1, 1);
		this.journalOverlay.Visible = false;
		this.journalOverlay.Parent = this.root;

		this.journalPanel.Name = "QuestJournalPanel";
		this.journalPanel.AnchorPoint = new Vector2(0.5, 0.5);
		this.journalPanel.BackgroundColor3 = ODYSSEY_COLORS.ink;
		this.journalPanel.BorderSizePixel = 0;
		this.journalPanel.Position = UDim2.fromScale(0.5, 0.5);
		this.journalPanel.Size = new UDim2(0.82, 0, 0.76, 0);
		this.journalPanel.Parent = this.journalOverlay;
		addOdysseyCorner(this.journalPanel, 12);
		addOdysseyPadding(this.journalPanel, 20, 18);
		const constraint = new Instance("UISizeConstraint");
		constraint.Name = "ResponsiveQuestJournalSize";
		constraint.MinSize = new Vector2(320, 340);
		constraint.MaxSize = new Vector2(920, 620);
		constraint.Parent = this.journalPanel;

		const eyebrow = createOdysseyText(
			this.journalPanel,
			"QuestJournalEyebrow",
			"ODYSSEY",
			11,
			Enum.Font.GothamBold,
		);
		eyebrow.TextColor3 = ODYSSEY_COLORS.gold;
		eyebrow.Position = new UDim2(0, 0, 0, 0);
		const title = createOdysseyText(this.journalPanel, "QuestJournalTitle", "QUEST LOG", 24, Enum.Font.GothamBold);
		title.Position = new UDim2(0, 0, 0, 20);
		title.Size = new UDim2(1, -56, 0, 30);

		this.journalClose.AnchorPoint = new Vector2(1, 0);
		this.journalClose.BackgroundColor3 = ODYSSEY_COLORS.navy;
		this.journalClose.Position = new UDim2(1, 0, 0, 0);
		this.journalClose.Size = new UDim2(0, 42, 0, 36);
		this.journalClose.TextSize = 24;

		this.activeTab.Position = new UDim2(0, 0, 0, 62);
		this.activeTab.Size = new UDim2(0, 112, 0, 36);
		this.allTab.Position = new UDim2(0, 120, 0, 62);
		this.allTab.Size = new UDim2(0, 128, 0, 36);

		const divider = new Instance("Frame");
		divider.Name = "QuestJournalDivider";
		divider.BackgroundColor3 = ODYSSEY_COLORS.gold;
		divider.BackgroundTransparency = 0.35;
		divider.BorderSizePixel = 0;
		divider.Position = new UDim2(0, 0, 0, 106);
		divider.Size = new UDim2(1, 0, 0, 1);
		divider.Parent = this.journalPanel;

		this.journalList.Name = "QuestJournalList";
		this.journalList.AutomaticCanvasSize = Enum.AutomaticSize.Y;
		this.journalList.BackgroundColor3 = ODYSSEY_COLORS.navy;
		this.journalList.BackgroundTransparency = 0.28;
		this.journalList.BorderSizePixel = 0;
		this.journalList.CanvasSize = new UDim2();
		this.journalList.Position = new UDim2(0, 0, 0, 120);
		this.journalList.ScrollBarImageColor3 = ODYSSEY_COLORS.gold;
		this.journalList.ScrollBarThickness = 4;
		this.journalList.Size = new UDim2(0.34, -8, 1, -120);
		this.journalList.Parent = this.journalPanel;
		addOdysseyCorner(this.journalList, 8);
		addOdysseyPadding(this.journalList, 8, 8);

		this.journalDetail.Name = "QuestJournalDetail";
		this.journalDetail.AutomaticCanvasSize = Enum.AutomaticSize.Y;
		this.journalDetail.BackgroundColor3 = ODYSSEY_COLORS.navy;
		this.journalDetail.BackgroundTransparency = 0.12;
		this.journalDetail.BorderSizePixel = 0;
		this.journalDetail.CanvasSize = new UDim2();
		this.journalDetail.Position = new UDim2(0.34, 8, 0, 120);
		this.journalDetail.ScrollBarImageColor3 = ODYSSEY_COLORS.gold;
		this.journalDetail.ScrollBarThickness = 4;
		this.journalDetail.Size = new UDim2(0.66, -8, 1, -120);
		this.journalDetail.Parent = this.journalPanel;
		addOdysseyCorner(this.journalDetail, 8);
		addOdysseyPadding(this.journalDetail, 16, 14);
	}

	private activeQuests(): QuestClientView[] {
		return this.quests.filter((quest) => quest.status === "Active");
	}

	private filteredQuests(): QuestClientView[] {
		return this.journalFilter === "Active" ? this.activeQuests() : [...this.quests];
	}

	private updateTrackerToggleText(): void {
		this.trackerToggle.Text = `QUESTS (${this.activeQuests().size()})  ${this.trackerExpanded ? "−" : "+"}`;
	}

	private renderTracker(): void {
		for (const child of this.trackerList.GetChildren()) child.Destroy();
		const layout = new Instance("UIListLayout");
		layout.Padding = new UDim(0, 8);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = this.trackerList;
		const active = this.activeQuests();
		this.trackerCount.Text = `${active.size()} ACTIVE`;
		this.updateTrackerToggleText();
		if (active.size() === 0) {
			const empty = createOdysseyText(
				this.trackerList,
				"TrackerEmpty",
				"No active quests",
				12,
				Enum.Font.GothamMedium,
			);
			empty.TextColor3 = ODYSSEY_COLORS.muted;
			return;
		}
		for (let index = 0; index < active.size(); index++) this.createTrackerCard(active[index], index + 1);
	}

	private createTrackerCard(quest: QuestClientView, order: number): void {
		const card = new Instance("TextButton");
		card.Name = `TrackerQuest_${quest.questId}`;
		card.AutoButtonColor = true;
		card.BackgroundColor3 = ODYSSEY_COLORS.navy;
		card.BorderSizePixel = 0;
		card.LayoutOrder = order;
		card.Size = new UDim2(1, -6, 0, 90);
		card.Text = "";
		card.Parent = this.trackerList;
		addOdysseyCorner(card, 7);
		addOdysseyPadding(card, 10, 8);

		const title = createOdysseyText(card, "QuestTitle", quest.title, 14, Enum.Font.GothamBold);
		title.Position = new UDim2(0, 0, 0, 0);
		const stage = createOdysseyText(card, "StageTitle", quest.stageTitle, 10, Enum.Font.GothamBold);
		stage.Position = new UDim2(0, 0, 0, 22);
		stage.TextColor3 = ODYSSEY_COLORS.gold;
		const objective = quest.objectives[0];
		if (objective !== undefined) {
			const progress = math.clamp(objective.progress, 0, objective.required);
			const text = createOdysseyText(
				card,
				"ObjectiveText",
				`${objective.description}  ${progress}/${objective.required}`,
				11,
				Enum.Font.Gotham,
			);
			text.Position = new UDim2(0, 0, 0, 43);
			text.TextColor3 = ODYSSEY_COLORS.muted;
			addProgressBar(card, progress, objective.required, new UDim2(0, 0, 1, -7));
		}
		card.Activated.Connect(() => {
			this.setJournalFilter("Active");
			this.selectedQuestId = quest.questId;
			this.setJournalOpen(true);
		});
	}

	private renderJournal(): void {
		this.activeTab.BackgroundColor3 = this.journalFilter === "Active" ? ODYSSEY_COLORS.gold : ODYSSEY_COLORS.navy;
		this.activeTab.TextColor3 = this.journalFilter === "Active" ? ODYSSEY_COLORS.ink : ODYSSEY_COLORS.parchment;
		this.allTab.BackgroundColor3 = this.journalFilter === "All" ? ODYSSEY_COLORS.gold : ODYSSEY_COLORS.navy;
		this.allTab.TextColor3 = this.journalFilter === "All" ? ODYSSEY_COLORS.ink : ODYSSEY_COLORS.parchment;

		const visible = this.filteredQuests();
		if (!visible.some((quest) => quest.questId === this.selectedQuestId)) {
			this.selectedQuestId = visible[0]?.questId;
		}
		this.renderJournalList(visible);
		this.renderJournalDetail(visible.find((quest) => quest.questId === this.selectedQuestId));
	}

	private renderJournalList(quests: ReadonlyArray<QuestClientView>): void {
		for (const child of this.journalList.GetChildren()) child.Destroy();
		const layout = new Instance("UIListLayout");
		layout.Padding = new UDim(0, 8);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = this.journalList;
		if (quests.size() === 0) {
			const empty = createOdysseyText(this.journalList, "QuestJournalEmpty", "No quests in this view", 12);
			empty.TextColor3 = ODYSSEY_COLORS.muted;
			return;
		}
		for (let index = 0; index < quests.size(); index++) {
			const quest = quests[index];
			const button = createButton(
				this.journalList,
				`QuestLogEntry_${quest.questId}`,
				`${quest.title}\n${quest.status.upper()}`,
			);
			button.BackgroundColor3 = quest.questId === this.selectedQuestId ? ODYSSEY_COLORS.gold : ODYSSEY_COLORS.ink;
			button.LayoutOrder = index + 1;
			button.Size = new UDim2(1, -4, 0, 62);
			button.TextColor3 = quest.questId === this.selectedQuestId ? ODYSSEY_COLORS.ink : ODYSSEY_COLORS.parchment;
			button.TextWrapped = true;
			button.Activated.Connect(() => this.selectQuest(quest.questId));
		}
	}

	private renderJournalDetail(quest: QuestClientView | undefined): void {
		for (const child of this.journalDetail.GetChildren()) child.Destroy();
		const layout = new Instance("UIListLayout");
		layout.Padding = new UDim(0, 8);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = this.journalDetail;
		if (quest === undefined) {
			const empty = createOdysseyText(
				this.journalDetail,
				"QuestDetailEmpty",
				"Select a quest to review its journey.",
				14,
				Enum.Font.GothamMedium,
			);
			empty.TextColor3 = ODYSSEY_COLORS.muted;
			return;
		}

		const title = createOdysseyText(
			this.journalDetail,
			"SelectedQuestTitle",
			quest.title,
			22,
			Enum.Font.GothamBold,
		);
		title.LayoutOrder = 1;
		const status = createOdysseyText(
			this.journalDetail,
			"SelectedQuestStatus",
			quest.status.upper(),
			11,
			Enum.Font.GothamBold,
		);
		status.LayoutOrder = 2;
		status.TextColor3 = ODYSSEY_COLORS.gold;
		const summary = createOdysseyText(this.journalDetail, "SelectedQuestSummary", quest.summary, 13);
		summary.LayoutOrder = 3;
		summary.TextColor3 = ODYSSEY_COLORS.muted;

		if (quest.status === "Completed") {
			const completed = createOdysseyText(
				this.journalDetail,
				"CompletedQuestMessage",
				"This chapter of your odyssey is complete.",
				14,
				Enum.Font.GothamMedium,
			);
			completed.LayoutOrder = 4;
			return;
		}

		const stage = createOdysseyText(
			this.journalDetail,
			"SelectedStageTitle",
			quest.stageTitle,
			16,
			Enum.Font.GothamBold,
		);
		stage.LayoutOrder = 4;
		stage.TextColor3 = ODYSSEY_COLORS.gold;
		for (let index = 0; index < quest.objectives.size(); index++) {
			this.createJournalObjective(quest.objectives[index], index + 5);
		}
	}

	private createJournalObjective(objective: QuestClientView["objectives"][number], order: number): void {
		const row = new Instance("Frame");
		row.Name = `JournalObjective_${objective.id}`;
		row.BackgroundColor3 = ODYSSEY_COLORS.ink;
		row.BackgroundTransparency = 0.18;
		row.BorderSizePixel = 0;
		row.LayoutOrder = order;
		row.Size = new UDim2(1, -4, 0, 58);
		row.Parent = this.journalDetail;
		addOdysseyCorner(row, 7);
		addOdysseyPadding(row, 10, 8);
		const progress = math.clamp(objective.progress, 0, objective.required);
		const text = createOdysseyText(
			row,
			"JournalObjectiveText",
			`${objective.description}  ${progress}/${objective.required}`,
			12,
			Enum.Font.GothamMedium,
		);
		text.Position = new UDim2(0, 0, 0, 0);
		addProgressBar(row, progress, objective.required, new UDim2(0, 0, 1, -7));
	}
}
