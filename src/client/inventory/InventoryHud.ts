import { InventoryItemClientView, InventoryServerMessage } from "shared/inventory/InventoryTypes";

const COLORS = {
	ink: Color3.fromRGB(20, 27, 39),
	navy: Color3.fromRGB(31, 43, 62),
	gold: Color3.fromRGB(216, 174, 72),
	parchment: Color3.fromRGB(241, 229, 198),
	muted: Color3.fromRGB(169, 177, 191),
	overlay: Color3.fromRGB(5, 8, 14),
} as const;

function corner(parent: GuiObject, pixels = 8): void {
	const value = new Instance("UICorner");
	value.CornerRadius = new UDim(0, pixels);
	value.Parent = parent;
}

function padding(parent: GuiObject, horizontal: number, vertical: number): void {
	const value = new Instance("UIPadding");
	value.PaddingLeft = new UDim(0, horizontal);
	value.PaddingRight = new UDim(0, horizontal);
	value.PaddingTop = new UDim(0, vertical);
	value.PaddingBottom = new UDim(0, vertical);
	value.Parent = parent;
}

function label(
	parent: Instance,
	name: string,
	text: string,
	size: number,
	font: Enum.Font = Enum.Font.Gotham,
): TextLabel {
	const value = new Instance("TextLabel");
	value.Name = name;
	value.AutomaticSize = Enum.AutomaticSize.Y;
	value.BackgroundTransparency = 1;
	value.Font = font;
	value.Size = new UDim2(1, 0, 0, size + 6);
	value.Text = text;
	value.TextColor3 = COLORS.parchment;
	value.TextSize = size;
	value.TextWrapped = true;
	value.TextXAlignment = Enum.TextXAlignment.Left;
	value.Parent = parent;
	return value;
}

export class InventoryHud {
	private readonly root = new Instance("ScreenGui");
	private readonly toggleButton = new Instance("TextButton");
	private readonly overlay = new Instance("Frame");
	private readonly panel = new Instance("Frame");
	private readonly closeButton = new Instance("TextButton");
	private readonly capacityLabel: TextLabel;
	private readonly content = new Instance("ScrollingFrame");

	public constructor(parent: Instance) {
		this.root.Name = "InventoryHud";
		this.root.DisplayOrder = 30;
		this.root.ResetOnSpawn = false;
		this.root.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets;
		this.root.SafeAreaCompatibility = Enum.SafeAreaCompatibility.None;
		this.root.ClipToDeviceSafeArea = true;
		this.root.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		this.root.Parent = parent;

		this.toggleButton.Name = "InventoryToggle";
		this.toggleButton.AnchorPoint = new Vector2(0, 0);
		this.toggleButton.AutoButtonColor = true;
		this.toggleButton.BackgroundColor3 = COLORS.ink;
		this.toggleButton.BorderSizePixel = 0;
		this.toggleButton.Font = Enum.Font.GothamBold;
		this.toggleButton.Position = new UDim2(0, 18, 0, 84);
		this.toggleButton.Size = new UDim2(0, 132, 0, 44);
		this.toggleButton.Text = "INVENTORY  [I]";
		this.toggleButton.TextColor3 = COLORS.parchment;
		this.toggleButton.TextSize = 13;
		this.toggleButton.Parent = this.root;
		corner(this.toggleButton, 9);

		this.overlay.Name = "InventoryOverlay";
		this.overlay.Active = true;
		this.overlay.BackgroundColor3 = COLORS.overlay;
		this.overlay.BackgroundTransparency = 0.28;
		this.overlay.BorderSizePixel = 0;
		this.overlay.Size = UDim2.fromScale(1, 1);
		this.overlay.Visible = false;
		this.overlay.Parent = this.root;

		this.panel.Name = "InventoryPanel";
		this.panel.AnchorPoint = new Vector2(0.5, 0.5);
		this.panel.BackgroundColor3 = COLORS.ink;
		this.panel.BorderSizePixel = 0;
		this.panel.Position = UDim2.fromScale(0.5, 0.5);
		this.panel.Size = new UDim2(0.72, 0, 0.72, 0);
		this.panel.Parent = this.overlay;
		corner(this.panel, 12);
		padding(this.panel, 20, 18);

		const constraint = new Instance("UISizeConstraint");
		constraint.Name = "ResponsiveInventorySize";
		constraint.MinSize = new Vector2(300, 340);
		constraint.MaxSize = new Vector2(760, 560);
		constraint.Parent = this.panel;

		const title = label(this.panel, "InventoryTitle", "INVENTORY", 24, Enum.Font.GothamBold);
		title.Position = new UDim2(0, 0, 0, 0);
		title.Size = new UDim2(1, -54, 0, 32);
		title.TextColor3 = COLORS.gold;

		this.closeButton.Name = "InventoryClose";
		this.closeButton.AnchorPoint = new Vector2(1, 0);
		this.closeButton.BackgroundColor3 = COLORS.navy;
		this.closeButton.BorderSizePixel = 0;
		this.closeButton.Font = Enum.Font.GothamBold;
		this.closeButton.Position = new UDim2(1, 0, 0, 0);
		this.closeButton.Size = new UDim2(0, 42, 0, 36);
		this.closeButton.Text = "×";
		this.closeButton.TextColor3 = COLORS.parchment;
		this.closeButton.TextSize = 25;
		this.closeButton.Parent = this.panel;
		corner(this.closeButton, 8);

		this.capacityLabel = label(this.panel, "InventoryCapacity", "0 / 200 SLOTS", 12, Enum.Font.GothamMedium);
		this.capacityLabel.Position = new UDim2(0, 0, 0, 42);
		this.capacityLabel.TextColor3 = COLORS.muted;

		const divider = new Instance("Frame");
		divider.Name = "InventoryDivider";
		divider.BackgroundColor3 = COLORS.gold;
		divider.BackgroundTransparency = 0.35;
		divider.BorderSizePixel = 0;
		divider.Position = new UDim2(0, 0, 0, 70);
		divider.Size = new UDim2(1, 0, 0, 1);
		divider.Parent = this.panel;

		this.content.Name = "InventoryContent";
		this.content.AutomaticCanvasSize = Enum.AutomaticSize.Y;
		this.content.BackgroundTransparency = 1;
		this.content.BorderSizePixel = 0;
		this.content.CanvasSize = new UDim2();
		this.content.Position = new UDim2(0, 0, 0, 84);
		this.content.ScrollBarImageColor3 = COLORS.gold;
		this.content.ScrollBarThickness = 5;
		this.content.Size = new UDim2(1, 0, 1, -84);
		this.content.Parent = this.panel;

		this.render({ kind: "Snapshot", items: [], occupiedSlots: 0, maximumSlots: 200 });
	}

	public render(snapshot: InventoryServerMessage): void {
		for (const child of this.content.GetChildren()) child.Destroy();
		const layout = new Instance("UIListLayout");
		layout.Padding = new UDim(0, 10);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = this.content;
		this.capacityLabel.Text = `${snapshot.occupiedSlots} / ${snapshot.maximumSlots} SLOTS`;
		if (snapshot.items.size() === 0) {
			const empty = label(this.content, "InventoryEmpty", "Your inventory is empty.", 15, Enum.Font.GothamMedium);
			empty.TextColor3 = COLORS.muted;
			return;
		}
		for (let index = 0; index < snapshot.items.size(); index++)
			this.createItemRow(snapshot.items[index], index + 1);
	}

	public setOpen(open: boolean): void {
		this.overlay.Visible = open;
		this.toggleButton.Visible = !open;
	}

	public isOpen(): boolean {
		return this.overlay.Visible;
	}

	public getToggleButton(): TextButton {
		return this.toggleButton;
	}

	public getCloseButton(): TextButton {
		return this.closeButton;
	}

	public getRoot(): ScreenGui {
		return this.root;
	}

	public destroy(): void {
		this.root.Destroy();
	}

	private createItemRow(item: InventoryItemClientView, order: number): void {
		const row = new Instance("Frame");
		row.Name = `InventoryItem_${item.itemId}`;
		row.AutomaticSize = Enum.AutomaticSize.Y;
		row.BackgroundColor3 = COLORS.navy;
		row.BorderSizePixel = 0;
		row.LayoutOrder = order;
		row.Size = new UDim2(1, -8, 0, 0);
		row.Parent = this.content;
		corner(row, 8);
		padding(row, 14, 11);
		const layout = new Instance("UIListLayout");
		layout.Padding = new UDim(0, 4);
		layout.Parent = row;
		const title = label(row, "ItemName", `${item.displayName}  ×${item.quantity}`, 16, Enum.Font.GothamBold);
		title.LayoutOrder = 1;
		const category = label(row, "ItemCategory", item.category.upper(), 10, Enum.Font.GothamBold);
		category.LayoutOrder = 2;
		category.TextColor3 = COLORS.gold;
		const description = label(row, "ItemDescription", item.description, 12);
		description.LayoutOrder = 3;
		description.TextColor3 = COLORS.muted;
	}
}
