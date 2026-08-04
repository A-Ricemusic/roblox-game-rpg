export const ODYSSEY_COLORS = {
	ink: Color3.fromRGB(20, 27, 39),
	navy: Color3.fromRGB(31, 43, 62),
	gold: Color3.fromRGB(216, 174, 72),
	parchment: Color3.fromRGB(241, 229, 198),
	muted: Color3.fromRGB(169, 177, 191),
	overlay: Color3.fromRGB(5, 8, 14),
	track: Color3.fromRGB(55, 65, 82),
} as const;

export function addOdysseyCorner(parent: GuiObject, pixels = 8): void {
	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, pixels);
	corner.Parent = parent;
}

export function addOdysseyPadding(parent: GuiObject, horizontal: number, vertical: number): void {
	const padding = new Instance("UIPadding");
	padding.PaddingLeft = new UDim(0, horizontal);
	padding.PaddingRight = new UDim(0, horizontal);
	padding.PaddingTop = new UDim(0, vertical);
	padding.PaddingBottom = new UDim(0, vertical);
	padding.Parent = parent;
}

export function createOdysseyText(
	parent: Instance,
	name: string,
	text: string,
	textSize: number,
	font: Enum.Font = Enum.Font.Gotham,
): TextLabel {
	const label = new Instance("TextLabel");
	label.Name = name;
	label.AutomaticSize = Enum.AutomaticSize.Y;
	label.BackgroundTransparency = 1;
	label.Font = font;
	label.Size = new UDim2(1, 0, 0, textSize + 6);
	label.Text = text;
	label.TextColor3 = ODYSSEY_COLORS.parchment;
	label.TextSize = textSize;
	label.TextWrapped = true;
	label.TextXAlignment = Enum.TextXAlignment.Left;
	label.Parent = parent;
	return label;
}
