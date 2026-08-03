# Inventory system implementation guide

This guide describes the production inventory slice implemented in roblox-ts. Read
[`player-database.md`](./player-database.md) before changing persistence and
[`quest-system-implementation.md`](./quest-system-implementation.md) before changing
the inventory-to-quest event bridge.

## Current scope

The system provides:

- immutable, validated item and starter-weapon definitions;
- server-authoritative, one-time-per-player world pickups;
- `CollectionService` registration with stable pickup IDs and metadata validation;
- interaction-distance, stack-capacity, duplicate, and profile-readiness checks;
- persistent item quantities and claimed pickup IDs;
- one aggregate Convex save containing inventory and quest state;
- a sanitized snapshot protocol plus a narrowly validated weapon-selection intent;
- a responsive, scrolling inventory GUI opened with `I`, controller `ButtonY`, or
  the on-screen Inventory button;
- server-authoritative Hoplite Sword equip/unequip controls in that GUI;
- a typed bridge that lets successful inventory grants progress collectible quests;
- Roblox Jest and Convex transaction/contract coverage.

The inventory persists weapon ownership and the selected weapon slot, while the
combat runtime remains responsible for materializing or removing the weapon model on
the character. The system does not use Roblox `Tool` Instances. Trading, dropping,
consuming, crafting, item instances, randomized affixes, weight, and multiple stacks
are also deferred.

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
InventoryPickupCoordinator ── applies the grant and publishes its quest fact
        │
		├── InventoryProfileService → PlayerProfileService → aggregate save/release
		├── InventoryRemoteService → sanitized GUI snapshot
		└── InventoryQuestBridge → collectible quest event

Inventory GUI Equip/Unequip intent
        │ rate-limited and parsed on the server
        ▼
InventoryRemoteService → InventoryEquipmentCoordinator
        ├── InventoryProfileService → persistent desired weapon slot
        └── WeaponRuntime → character sword model + grip motor
```

The client can request a fresh snapshot or request a selected weapon ID/empty weapon
slot. It cannot author ownership, quantities, pickup IDs, grants, removals, or
inventory counters. The server accepts an equipment choice only when its definition
is a weapon and the loaded profile owns it. Pickup metadata comes from registered
server Instances and item definitions.

## Module map

- `src/shared/inventory/InventoryTypes.ts`: definitions, persistent state, grants,
  limits, and client contracts.
- `InventoryDefinitions.ts`: content registry for inventory items and owned weapons.
- `InventoryDefinitionValidator.ts`: startup validation.
- `InventoryEngine.ts`: pure immutable pickup and equipment reducers.
- `InventoryProfileCodec.ts`: validation of untrusted persisted inventory data.
- `InventoryViewModel.ts` and `InventoryRemoteProtocol.ts`: sanitized networking.
- `src/server/inventory/WorldPickupMetadata.ts`: tag/attribute contract and distance
  rules.
- `WorldPickupRegistry.ts`: live CollectionService cache and duplicate-ID rejection.
- `WorldPickupClaimService.ts`: authoritative interaction boundary.
- `InventoryPickupCoordinator.ts`: the public grant-and-quest orchestration boundary.
- `InventoryProfileService.ts`: inventory facade over the aggregate player profile.
- `InventoryEquipmentCoordinator.ts`: commits desired equipment state before asking
  combat to reconcile the character.
- `InventoryQuestBridge.ts`: one-way publication of successful item grants to quests.
- `InventoryRemoteService.ts`: separately rate-limited snapshot and equipment intents.
- `src/client/inventory/InventoryHud.ts`: inventory panel and persistent open button.
- `InventoryClientController.ts`: keyboard/controller/button input and replication.
- `src/server/weapons/WeaponRuntime.ts`: respawn-safe physical realization and attack
  authorization against the selected inventory weapon.
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
text. Weapon definitions must use the `Weapon` category and `Weapon` equipment slot;
only server-validated owned weapon IDs may be selected.
Adding another weapon also requires updating the Convex supported-weapon allowlist
and implementing its physical materializer in the combat runtime before profiles may
select it.

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

`InventoryPickupId` may contain at most 115 characters. The inventory engine prefixes
it with `world-pickup:` to produce the quest transaction ID, keeping that persisted
ID within the shared 128-character limit.

## State and capacity rules

`InventoryProfile` stores:

- schema version;
- a map of stable item ID to positive quantity;
- stable world pickup IDs already claimed by this player;
- a versioned equipment object with an optional selected weapon ID.

New players and legacy profiles receive one `hoplite_sword`, equipped by default.
Choosing Unequip stores an empty weapon slot and removes the character model and grip
motor. Choosing Equip validates ownership, persists the selected ID, and asks the
combat runtime to recreate the sword. Respawns reapply the persisted selection.
The versioned object is intentionally never an empty Lua table: Roblox JSON encodes
an empty table as `[]`, which is not a Convex object. Unequipped state is therefore
`{ schemaVersion: 1 }`, not `{}`.

The GUI displays persistent desired state. Physical realization normally completes
in the same request; incomplete R15 rigs receive bounded retries, and respawn
reconciles again. Missing or malformed assets produce server warnings instead of
silently changing the saved selection, so operators can repair content without
discarding player intent.

The current inventory supports 200 distinct item types and 1024 lifetime world
pickup IDs. Each definition supplies its own maximum quantity. Grants are
all-or-nothing: a pickup that would exceed a stack or profile limit is rejected and
its pickup ID is not consumed.

These bounds protect Convex document size and Roblox/Convex validation cost. A world
with more than 1024 permanent pickups will need a region-compressed collection model
or a deliberately repeatable pickup policy rather than raising the limit blindly.

## Persistence and migration

`PlayerProfileService` is the sole loaded aggregate owner. Quest and inventory
services receive domain-specific views and replace only their own immutable child
profile. Autosave and disconnect then write both domains with one Convex lease,
revision, and idempotency key.

Existing quest-only Convex documents remain readable because `inventoryProfile` is
additive and optional in the table schema. Convex acquisition deliberately supplies a
legacy-compatible empty inventory when the field is absent. The new Roblox codec then
migrates it in memory to one equipped Hoplite Sword, and the next save writes the new
aggregate shape. Inventory profiles from before weapon equipment are migrated the same
way.
An explicit `{ schemaVersion: 1 }` remains unequipped and is never mistaken for a
legacy profile. If a legacy inventory is already at the 200-item hard limit, it is
kept intact and loaded unequipped rather than dropping an item or quarantining the
player. Legacy Roblox quest DataStore migration creates the same starter inventory.

This change requires a staged production rollout. First deploy the additive Convex
schema/functions; its synthesized empty inventory is still readable by the
pre-weapon build. Then shut down or drain every pre-weapon Roblox server before
publishing the build that can write `hoplite_sword` and `equipment`. The optional
field keeps old documents readable, but it does not make old servers able to read
new weapon IDs or preserve new equipment state. Do not allow old and new Roblox
builds to serve players concurrently after weapon migration begins.

If decoding or definition validation fails after acquisition, the server calls the
authenticated abandon endpoint to release the session without overwriting data.

Loaded profiles track whether either domain changed. Dirty autosaves write the whole
aggregate once; clean autosaves send only a lightweight Convex lease renewal. Player
disconnect always performs an atomic aggregate save-and-release.

Item IDs and stack limits are persisted contracts. Never remove an item definition,
rename its ID, or reduce its `maxStack` while saved profiles may still contain the old
value. Ship a codec migration or a retained tombstone definition first, backfill the
data, and only then tighten the registry.

## Extension rules

- Inventory owns item grants and removals. Quests observe successful grant facts.
- Inventory owns weapon ownership and persistent desired equipment state.
- Combat owns attack/animation behavior and physical character weapon realization;
  it must also authorize attacks against inventory's current desired state.
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
