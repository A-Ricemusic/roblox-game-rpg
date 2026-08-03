export const QUEST_COLLECTIBLE_TAG = "QuestCollectible";

export const QUEST_COLLECTIBLE_ATTRIBUTES = {
	collectibleId: "QuestCollectibleId",
	itemId: "QuestItemId",
	quantity: "QuestItemQuantity",
} as const;

export interface CollectibleMetadata {
	readonly collectibleId: string;
	readonly itemId: string;
	readonly quantity: number;
}

export type CollectibleValidationResult =
	{ readonly ok: true; readonly metadata: CollectibleMetadata } | { readonly ok: false; readonly error: string };

const MAX_ATTRIBUTE_ID_LENGTH = 128;
const MAX_COLLECTION_QUANTITY = 1_000;

function readRequiredId(instance: Instance, attributeName: string): string | undefined {
	const value = instance.GetAttribute(attributeName);
	return typeIs(value, "string") && value.size() > 0 && value.size() <= MAX_ATTRIBUTE_ID_LENGTH ? value : undefined;
}

export function getCollectiblePosition(instance: Instance): Vector3 | undefined {
	if (instance.IsA("BasePart")) {
		return instance.Position;
	}
	if (instance.IsA("Attachment")) {
		return instance.WorldPosition;
	}
	if (instance.IsA("Model") && instance.PrimaryPart !== undefined) {
		return instance.PrimaryPart.Position;
	}
	return undefined;
}

export function validateCollectibleMetadata(instance: Instance): CollectibleValidationResult {
	if (getCollectiblePosition(instance) === undefined) {
		return { ok: false, error: "Tagged collectible must be a BasePart, Attachment, or Model with a PrimaryPart." };
	}

	const collectibleId = readRequiredId(instance, QUEST_COLLECTIBLE_ATTRIBUTES.collectibleId);
	if (collectibleId === undefined) {
		return { ok: false, error: `Missing or invalid '${QUEST_COLLECTIBLE_ATTRIBUTES.collectibleId}' attribute.` };
	}

	const itemId = readRequiredId(instance, QUEST_COLLECTIBLE_ATTRIBUTES.itemId);
	if (itemId === undefined) {
		return { ok: false, error: `Missing or invalid '${QUEST_COLLECTIBLE_ATTRIBUTES.itemId}' attribute.` };
	}

	const quantity = instance.GetAttribute(QUEST_COLLECTIBLE_ATTRIBUTES.quantity) ?? 1;
	if (
		!typeIs(quantity, "number") ||
		quantity < 1 ||
		math.floor(quantity) !== quantity ||
		quantity > MAX_COLLECTION_QUANTITY
	) {
		return {
			ok: false,
			error: `'${QUEST_COLLECTIBLE_ATTRIBUTES.quantity}' must be an integer from 1 to ${MAX_COLLECTION_QUANTITY}.`,
		};
	}

	return { ok: true, metadata: { collectibleId, itemId, quantity } };
}

export function isCharacterWithinCollectibleDistance(
	character: Model | undefined,
	collectible: Instance,
	maxDistance: number,
): boolean {
	if (character === undefined || maxDistance < 0 || maxDistance >= math.huge) {
		return false;
	}
	const root = character.FindFirstChild("HumanoidRootPart");
	const position = getCollectiblePosition(collectible);
	return root !== undefined && root.IsA("BasePart") && position !== undefined
		? root.Position.sub(position).Magnitude <= maxDistance
		: false;
}
