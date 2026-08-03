export const INVENTORY_PROFILE_SCHEMA_VERSION = 1;
export const MAX_INVENTORY_ITEM_TYPES = 200;
export const MAX_CLAIMED_WORLD_PICKUPS = 1_024;
export const MAX_INVENTORY_ID_LENGTH = 128;
export const MAX_INVENTORY_STACK_QUANTITY = 1_000_000;
export const WORLD_PICKUP_TRANSACTION_PREFIX = "world-pickup:";
export const MAX_WORLD_PICKUP_ID_LENGTH = MAX_INVENTORY_ID_LENGTH - WORLD_PICKUP_TRANSACTION_PREFIX.size();

export type InventoryItemId = string;
export type InventoryItemCategory = "Material" | "Consumable" | "Quest" | "Weapon" | "Miscellaneous";
export type InventoryEquipmentSlot = "Weapon";

export interface InventoryItemDefinition {
	readonly id: InventoryItemId;
	readonly displayName: string;
	readonly description: string;
	readonly category: InventoryItemCategory;
	readonly maxStack: number;
	readonly iconAssetId?: string;
	readonly canDrop: boolean;
	readonly equipSlot?: InventoryEquipmentSlot;
}

export interface InventoryEquipment {
	readonly schemaVersion: 1;
	readonly weapon?: InventoryItemId;
}

export interface InventoryProfile {
	readonly schemaVersion: typeof INVENTORY_PROFILE_SCHEMA_VERSION;
	readonly itemQuantities: Readonly<Record<InventoryItemId, number>>;
	readonly claimedWorldPickupIds: ReadonlyArray<string>;
	readonly equipment: InventoryEquipment;
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

export type InventoryEquipmentFailureReason = "UnknownItem" | "NotOwned" | "NotEquippable";

export type InventoryEquipmentResult =
	| { readonly ok: true; readonly profile: InventoryProfile; readonly changed: boolean }
	| { readonly ok: false; readonly reason: InventoryEquipmentFailureReason };

export interface InventoryItemClientView {
	readonly itemId: InventoryItemId;
	readonly displayName: string;
	readonly description: string;
	readonly category: InventoryItemCategory;
	readonly quantity: number;
	readonly iconAssetId?: string;
	readonly equipSlot?: InventoryEquipmentSlot;
	readonly equipped: boolean;
}

export type InventoryClientRequest =
	{ readonly kind: "RequestSnapshot" } | { readonly kind: "SetWeaponEquipped"; readonly itemId?: InventoryItemId };

export type InventoryServerMessage = Readonly<{
	kind: "Snapshot";
	items: ReadonlyArray<InventoryItemClientView>;
	occupiedSlots: number;
	maximumSlots: number;
}>;
