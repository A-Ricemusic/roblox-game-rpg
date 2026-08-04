import { UserInputService } from "@rbxts/services";

import { PlayerResourceKind, PlayerResourceSnapshot, PlayerResourceValue } from "shared/resources/PlayerResourceTypes";

import { addOdysseyCorner, addOdysseyPadding, ODYSSEY_COLORS } from "../ui/OdysseyUi";

interface ResourceRow {
	readonly fill: Frame;
	readonly value: TextLabel;
}

const RESOURCE_COLORS: Readonly<Record<PlayerResourceKind, Color3>> = {
	Health: Color3.fromRGB(166, 66, 66),
	Stamina: Color3.fromRGB(104, 143, 76),
	Magic: Color3.fromRGB(66, 121, 177),
};

export class PlayerResourceHud {
	private readonly root = new Instance("ScreenGui");
	private readonly stack = new Instance("Frame");
	private readonly rows = new Map<PlayerResourceKind, ResourceRow>();

	public constructor(parent: Instance, touchLayout = UserInputService.TouchEnabled) {
		this.root.Name = "PlayerResourceHud";
		this.root.ClipToDeviceSafeArea = true;
		this.root.DisplayOrder = 12;
		this.root.ResetOnSpawn = false;
		this.root.SafeAreaCompatibility = Enum.SafeAreaCompatibility.None;
		this.root.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets;
		this.root.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		this.root.Parent = parent;

		this.stack.Name = "ResourceStack";
		this.stack.AnchorPoint = touchLayout ? new Vector2(0.5, 1) : new Vector2(0, 1);
		this.stack.BackgroundColor3 = ODYSSEY_COLORS.ink;
		this.stack.BackgroundTransparency = 0.08;
		this.stack.BorderSizePixel = 0;
		this.stack.Position = touchLayout ? new UDim2(0.5, 0, 1, -126) : new UDim2(0, 18, 1, -24);
		this.stack.Size = touchLayout ? new UDim2(0.56, 0, 0, 112) : new UDim2(0.25, 0, 0, 112);
		this.stack.Parent = this.root;
		addOdysseyCorner(this.stack, 10);
		addOdysseyPadding(this.stack, 10, 9);
		const constraint = new Instance("UISizeConstraint");
		constraint.Name = "ResponsiveResourceSize";
		constraint.MinSize = new Vector2(240, 112);
		constraint.MaxSize = new Vector2(touchLayout ? 300 : 340, 112);
		constraint.Parent = this.stack;
		const layout = new Instance("UIListLayout");
		layout.Padding = new UDim(0, 5);
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Parent = this.stack;

		this.rows.set("Health", this.createRow("Health", 1));
		this.rows.set("Stamina", this.createRow("Stamina", 2));
		this.rows.set("Magic", this.createRow("Magic", 3));
	}

	public render(snapshot: PlayerResourceSnapshot): void {
		this.renderValue("Health", snapshot.health);
		this.renderValue("Stamina", snapshot.stamina);
		this.renderValue("Magic", snapshot.magic);
	}

	public getRoot(): ScreenGui {
		return this.root;
	}

	public destroy(): void {
		this.root.Destroy();
	}

	private createRow(kind: PlayerResourceKind, order: number): ResourceRow {
		const track = new Instance("Frame");
		track.Name = `${kind}Track`;
		track.BackgroundColor3 = ODYSSEY_COLORS.track;
		track.BorderSizePixel = 0;
		track.ClipsDescendants = true;
		track.LayoutOrder = order;
		track.Size = new UDim2(1, 0, 0, 28);
		track.Parent = this.stack;
		addOdysseyCorner(track, 6);

		const fill = new Instance("Frame");
		fill.Name = `${kind}Fill`;
		fill.BackgroundColor3 = RESOURCE_COLORS[kind];
		fill.BorderSizePixel = 0;
		fill.Size = UDim2.fromScale(0, 1);
		fill.Parent = track;
		addOdysseyCorner(fill, 6);

		const label = new Instance("TextLabel");
		label.Name = `${kind}Label`;
		label.BackgroundTransparency = 1;
		label.Font = Enum.Font.GothamBold;
		label.Position = new UDim2(0, 9, 0, 0);
		label.Size = new UDim2(0.5, -9, 1, 0);
		label.Text = kind.upper();
		label.TextColor3 = ODYSSEY_COLORS.parchment;
		label.TextSize = 11;
		label.TextXAlignment = Enum.TextXAlignment.Left;
		label.Parent = track;

		const value = new Instance("TextLabel");
		value.Name = `${kind}Value`;
		value.BackgroundTransparency = 1;
		value.Font = Enum.Font.GothamMedium;
		value.Position = new UDim2(0.5, 0, 0, 0);
		value.Size = new UDim2(0.5, -9, 1, 0);
		value.Text = "0 / 100";
		value.TextColor3 = ODYSSEY_COLORS.parchment;
		value.TextSize = 11;
		value.TextXAlignment = Enum.TextXAlignment.Right;
		value.Parent = track;
		return { fill, value };
	}

	private renderValue(kind: PlayerResourceKind, resource: PlayerResourceValue): void {
		const row = this.rows.get(kind);
		if (row === undefined) return;
		const ratio = resource.maximum > 0 ? math.clamp(resource.current / resource.maximum, 0, 1) : 0;
		row.fill.Size = new UDim2(ratio, 0, 1, 0);
		row.value.Text = `${math.floor(resource.current + 0.5)} / ${math.floor(resource.maximum + 0.5)}`;
	}
}
