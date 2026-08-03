# Inventory system implementation guide

This guide describes the production inventory slice implemented in roblox-ts. Read
[`player-database.md`](./player-database.md) before changing persistence and
[`quest-system-implementation.md`](./quest-system-implementation.md) before changing
the inventory-to-quest event bridge.

## Current scope

The system provides:

- immutable, validated non-weapon item definitions;
- server-authoritative, one-time-per-player world pickups;
- `CollectionService` registration with stable pickup IDs and metadata validation;
- interaction-distance, stack-capacity, duplicate, and profile-readiness checks;
- persistent item quantities and claimed pickup IDs;
- one aggregate Convex save containing inventory and quest state;
- a sanitized, read-only client snapshot protocol;
- a responsive, scrolling inventory GUI opened with `I`, controller `ButtonY`, or
  the on-screen Inventory button;
- a typed bridge that lets successful inventory grants progress collectible quests;
- Roblox Jest and Convex transaction/contract coverage.

It does not create, spawn, equip, serialize, or otherwise manage weapons or Roblox
`Tool` Instances. Weapon inventory/equipment must be designed as an explicit later
integration with the combat owner. Trading, dropping, consuming, crafting, item
instances, randomized affixes, weight, and multiple stacks are also deferred.

## Runtime flow

```text
Tagged world Instance + ProximityPrompt
        │ server PromptTriggered
        ▼
WorldPickupRegistry ── validates and caches trusted metadata
        │
        ▼
WorldPickupClaimService ── checks registration and player distance
        │
        ▼
InventoryProfileService ── applies the pure, idempotent world-pickup grant
        │
        ├── PlayerProfileService → aggregate Convex autosave/release
        ├── InventoryRemoteService → sanitized GUI snapshot
        └── InventoryQuestBridge → collectible quest event
```

The client can only request a fresh snapshot. It cannot send item IDs, quantities,
pickup IDs, grants, removals, or inventory counters. Metadata comes from registered
server Instances and item definitions.

## Module map

- `src/shared/inventory/InventoryTypes.ts`: definitions, persistent state, grants,
  limits, and client contracts.
- `InventoryDefinitions.ts`: content registry for non-weapon items.
- `InventoryDefinitionValidator.ts`: startup validation.
- `InventoryEngine.ts`: pure immutable world-pickup reducer.
- `InventoryProfileCodec.ts`: validation of untrusted persisted inventory data.
- `InventoryViewModel.ts` and `InventoryRemoteProtocol.ts`: sanitized networking.
- `src/server/inventory/WorldPickupMetadata.ts`: tag/attribute contract and distance
  rules.
- `WorldPickupRegistry.ts`: live CollectionService cache and duplicate-ID rejection.
- `WorldPickupClaimService.ts`: authoritative interaction boundary.
- `InventoryProfileService.ts`: inventory facade over the aggregate player profile.
- `InventoryQuestBridge.ts`: one-way publication of successful item grants to quests.
- `InventoryRemoteService.ts`: rate-limited, read-only snapshots.
- `src/client/inventory/InventoryHud.ts`: inventory panel and persistent open button.
- `InventoryClientController.ts`: keyboard/controller/button input and replication.
- `src/server/player/`: aggregate quest/inventory lifecycle and persistence adapters.

## Authoring an item

Add a stable definition to `InventoryDefinitions.ts`:

```ts
{
    id: "marble_fragment",
    displayName: "Marble Fragment",
    description: "A weathered fragment from an ancient monument.",
    category: "Material",
    maxStack: 999,
    canDrop: true,
} as const satisfies InventoryItemDefinition
```

IDs are persistence and cross-system contracts. Do not rename them to change display
text. Do not add weapon IDs until the inventory/combat integration has been designed
with explicit equipment ownership.

## Authoring a world pickup

1. Create a `BasePart`, `Attachment`, or `Model` with a `PrimaryPart`.
2. Add a descendant `ProximityPrompt`.
3. Tag the root Instance `InventoryPickup` using CollectionService.
4. Add these attributes:

   - `InventoryPickupId`: globally unique, stable world-source ID;
   - `InventoryItemId`: exact ID from `InventoryDefinitions.ts`;
   - `InventoryItemQuantity`: optional integer from 1 through 1000, defaulting to 1.

The pickup remains visible and usable for other players. A player who has already
claimed its stable ID receives no second grant, including after reconnecting. Reusing
an old pickup ID for a different object will therefore make it appear already claimed
to existing players.

## State and capacity rules

`InventoryProfile` stores only:

- schema version;
- a map of stable item ID to positive quantity;
- stable world pickup IDs already claimed by this player.

The current inventory supports 200 distinct item types and 5000 lifetime world
pickup IDs. Each definition supplies its own maximum quantity. Grants are
all-or-nothing: a pickup that would exceed a stack or profile limit is rejected and
its pickup ID is not consumed.

These bounds protect Convex document size and Roblox/Convex validation cost. A world
with more than 5000 permanent pickups will need a region-compressed collection model
or a deliberately repeatable pickup policy rather than raising the limit blindly.

## Persistence and migration

`PlayerProfileService` is the sole loaded aggregate owner. Quest and inventory
services receive domain-specific views and replace only their own immutable child
profile. Autosave and disconnect then write both domains with one Convex lease,
revision, and idempotency key.

Existing quest-only Convex documents remain readable because `inventoryProfile` is
additive and optional in the table schema. Acquisition supplies an empty inventory
when the field is absent; the next save writes the aggregate shape. Legacy Roblox
quest DataStore migration also creates an empty inventory.

If decoding or definition validation fails after acquisition, the server calls the
authenticated abandon endpoint to release the session without overwriting data.

## Extension rules

- Inventory owns item grants and removals. Quests observe successful grant facts.
- Combat owns weapon state, attacks, animation, equipping, and Tool behavior.
- Rewards should call an idempotent general grant API, not edit quantities directly.
- Consuming an item requires an authoritative inventory transaction and a separate
  client intent protocol with rate and state validation.
- Dropped/traded item instances require unique ownership/transaction IDs so moving an
  existing item cannot manufacture quest progress.
- Never send Convex credentials or direct HTTP access to a Roblox client.

## Quality gates

Run strict roblox-ts compilation, the Roblox runtime suite, Convex tests, and both
Rojo builds. Tests for Instances, CollectionService, distance, GUI, remotes, and the
inventory/quest bridge belong in Roblox. Convex validators and transactional HTTP
actions use `convex-test`.
