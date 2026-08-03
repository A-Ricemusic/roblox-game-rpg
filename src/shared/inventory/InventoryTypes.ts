export const INVENTORY_PROFILE_SCHEMA_VERSION = 1;
export const MAX_INVENTORY_ITEM_TYPES = 200;
export const MAX_CLAIMED_WORLD_PICKUPS = 5_000;
export const MAX_INVENTORY_ID_LENGTH = 128;

export type InventoryItemId = string;
export type InventoryItemCategory = "Material" | "Consumable" | "Quest" | "Miscellaneous";

export interface InventoryItemDefinition {
	readonly id: InventoryItemId;
	readonly displayName: string;
	readonly description: string;
	readonly category: InventoryItemCategory;
	readonly maxStack: number;
	readonly iconAssetId?: string;
	readonly canDrop: boolean;
}

export interface InventoryProfile {
	readonly schemaVersion: typeof INVENTORY_PROFILE_SCHEMA_VERSION;
	readonly itemQuantities: Readonly<Record<InventoryItemId, number>>;
	readonly claimedWorldPickupIds: ReadonlyArray<string>;
}

export interface WorldPickupGrant {
	readonly pickupId: string;
	readonly itemId: InventoryItemId;
	readonly quantity: number;
}

export interface InventoryItemGrantedEvent {
	readonly kind: "ItemGranted";
	readonly transactionId: string;
	readonly itemId: InventoryItemId;
	readonly quantity: number;
	readonly source: "WorldPickup";
}

export type InventoryGrantFailureReason =
	"UnknownItem" | "InvalidGrant" | "AlreadyClaimed" | "InventoryFull" | "PickupHistoryFull";

export type InventoryGrantResult =
	| {
			readonly ok: true;
			readonly profile: InventoryProfile;
			readonly event: InventoryItemGrantedEvent;
	  }
	| { readonly ok: false; readonly reason: InventoryGrantFailureReason };

export interface InventoryItemClientView {
	readonly itemId: InventoryItemId;
	readonly displayName: string;
	readonly description: string;
	readonly category: InventoryItemCategory;
	readonly quantity: number;
	readonly iconAssetId?: string;
}

export type InventoryClientRequest = { readonly kind: "RequestSnapshot" };

export type InventoryServerMessage = Readonly<{
	kind: "Snapshot";
	items: ReadonlyArray<InventoryItemClientView>;
	occupiedSlots: number;
	maximumSlots: number;
}>;
