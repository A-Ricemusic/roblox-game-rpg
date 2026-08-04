# Quest system implementation guide

This is the practical guide for agents changing the shipped quest system. Read it
with [`quest-system-design.md`](./quest-system-design.md), which describes the larger
target architecture, and [`player-database.md`](./player-database.md), which owns
persistence and environment configuration.

## Current scope

The implemented slice supports:

- immutable, validated quest definitions;
- automatically started quests;
- ordered stages containing one or more parallel `CollectItem` objectives;
- server-authoritative collection from `CollectionService`-tagged world Instances;
- per-objective duplicate-source protection and capped progress;
- multiple simultaneous active quests;
- display-only active/completed snapshots sent to a compact tracker and quest log;
- schema-validated Convex persistence with legacy DataStore migration;
- deterministic Roblox Jest coverage plus Convex transaction/API tests.

It does **not** yet implement manual acceptance, abandonment, NPC conversations,
enemy defeat objectives, turn-in, rewards, repeatable quests, branching, or
persistent player-selected pinning. The final stage currently completes immediately and the
quest moves from `activeQuests` into `completedQuestIds`. Do not mistake future-state
examples in the design document for shipped behavior.

## Runtime flow

```text
InventoryPickup-tagged world Instance + ProximityPrompt
        │ server PromptTriggered
        ▼
WorldPickupRegistry ── validates/caches trusted item metadata
        │
        ▼
InventoryPickupCoordinator ── grants inventory, emits CollectibleAcquiredEvent
        ▼
QuestProfileService ── owns each loaded player's immutable profile value
        │
        ▼
QuestEngine ── pure matching, deduplication, progress and stage transition
        │
        ├── updated profile → repository autosave / release
        └── progress change → server-generated snapshot
                              │
                              ▼
                        QuestRemoteService
                              │ RemoteEvent
                              ▼
                    QuestClientController → QuestHud
```

The client never sends item IDs, quantities, source IDs, progress, or completion.
Its only accepted quest request is `{ kind: "RequestSnapshot" }`. All progress facts
originate from server-owned Instances and services.

## Module map

### Shared domain (`src/shared/quests`)

- `QuestTypes.ts` is the canonical TypeScript contract for definitions, events,
  profile state, changes, and client views.
- `QuestDefinitions.ts` contains **The First Harvest** and the registry. It is the
  current content-authoring entry point.
- `QuestDefinitionValidator.ts` rejects invalid content at server startup.
- `QuestEngine.ts` contains pure state construction and event reduction. It must not
  access Roblox services, networking, Instances, or persistence.
- `QuestProfileCodec.ts` treats loaded persistence as `unknown`, validates it, and
  migrates schema version `0` to the current schema.
- `QuestProfileDefinitionValidator.ts` checks decoded active state against installed
  content versions, stages, objectives, and caps.
- `QuestViewModel.ts` creates the sanitized client projection.
- `QuestRemoteProtocol.ts` validates both client requests and server snapshots at
  the network boundary.

### Server orchestration (`src/server`)

- `main.server.ts` wires player load/save/unload, autosave, prompt claims, remotes,
  registry lifetime, and shutdown.
- `player/PlayerProfileService.ts` owns loaded aggregate profiles;
  `quests/QuestProfileService.ts` is the quest-domain facade.
- `quests/QuestRemoteService.ts` rate-limits read-only snapshot requests.
- `inventory/WorldPickupMetadata.ts` defines the canonical tag, attributes, and
  distance rules for collectible items.
- `inventory/WorldPickupRegistry.ts` tracks valid tagged Instances and globally
  unique pickup source IDs.
- `inventory/InventoryPickupCoordinator.ts` grants inventory and publishes the
  resulting authoritative event through `InventoryQuestBridge`.
- `collectibles/` retains the older quest-only `QuestCollectible` path for existing
  place compatibility. Do not use it for newly authored item pickups.
- `player/persistence/` contains aggregate Convex, DataStore, memory, retry, and fake
  adapters. `quests/persistence/` retains the legacy quest DataStore migration reader.
- `config/PlayerDatabaseConfig.ts` selects isolated Studio versus production
  persistence configuration.

### Client (`src/client/quests`)

- `QuestClientController.ts` listens for validated snapshots and requests an initial
  snapshot. It never predicts or mutates quest state.
- `QuestHud.ts` owns the compact bounded tracker, Active/All quest-log filters, and
  client-local quest selection. It renders only the sanitized view supplied by the
  server; selection and expansion are presentation state, not quest progression.

### Convex (`convex`)

- `schema.ts` defines indexed `playerProfiles` documents.
- `validators.ts` mirrors and semantically validates the persisted quest profile.
- `playerProfiles.ts` owns acquisition leases, optimistic revisions, idempotent
  saves, atomic save-and-release, and migration completion.
- `http.ts` exposes authenticated server-only HTTP Actions.

When the Roblox profile shape changes, update the Roblox codec and Convex validators
in the same change. A successful `rbxtsc` build alone does not validate the Convex
contract.

## Profile and state rules

`QuestProfile` stores only stable IDs, small counters, timestamps, and processed
source IDs. Never persist Roblox Instances, display objects, connections, full quest
definitions, or client-provided data.

Each active state contains:

- `questId` and `definitionVersion`;
- `status` (`Active` while persisted);
- the zero-based current stage index;
- progress only for objectives in the current stage;
- start and update timestamps.

On a stage transition, old objective progress is replaced with freshly initialized
progress for the next stage. On final completion, the active state is removed and
the stable quest ID is appended once to `completedQuestIds`.

Profiles are treated as immutable values. Reducers return the original object when
nothing changes and a new object when progress changes. Repository retry logic relies
on this identity behavior when resolving an uncertain idempotent write before a newer
profile is saved.

Aggregate document budgets cap installed/tracked quests at 1024, simultaneous active
quests at 64, stages per quest at 64, objectives per stage at 32, objective
requirements at 2048, and total processed source IDs across active objectives at
2048. Raise these only with a measured storage migration; they protect the shared
quest/inventory Convex document, not just gameplay balance.

## Authoring a collectible quest

1. Add the quest to `QuestDefinitions.ts` using stable lowercase snake-case IDs.
2. Use `as const satisfies QuestDefinition` so content remains literal and typed.
3. Keep objective IDs unique across the entire quest.
4. Set `autoStart: true` only when every new player should immediately receive it.
5. Set `allowedSources: ["WorldTag"]` for the current collectible integration.
6. Run the definition validator tests before placing world content.
7. Define the item in `InventoryDefinitions.ts`, then tag each world Instance
   `InventoryPickup`.
8. Add these attributes:

   - `InventoryPickupId`: globally unique, stable source ID, at most 115 characters;
   - `InventoryItemId`: exact inventory and objective item ID;
   - `InventoryItemQuantity`: optional integer from 1 through 1000.

9. Use a `BasePart`, `Attachment`, or `Model` with a `PrimaryPart`, and place a
   `ProximityPrompt` under the tagged Instance.
10. Add reducer, registry/claim, view-model, protocol, and HUD tests as appropriate.

The legacy `QuestCollectible` tag remains runtime-compatible for old place content,
but it progresses quests without granting inventory. Migrate those objects to the
canonical `InventoryPickup` contract instead of creating new legacy collectibles.

Never reuse a collectible ID after moving or replacing an object if an existing
player may already have processed that source. Display names and Instance paths are
not persistent IDs.

## Event and stage semantics

- Only objectives in the current stage observe an event.
- Objectives in one stage progress in parallel.
- The stage advances only when every current objective is complete.
- The event that completes a stage is not replayed into the next stage.
- Progress never exceeds `required`.
- A `sourceId` can contribute to a given objective only once, across reconnects.
- One event may update multiple active quests whose current objectives match.
- Wrong item IDs, disallowed sources, invalid quantities, completed quests, missing
  definitions, and incompatible definition versions do nothing.

## Adding a new objective kind

Do not add quest-title conditionals or allow another system to increment counters.
Extend the typed event pipeline:

1. Add a definition variant and authoritative event to the discriminated unions in
   `QuestTypes.ts`.
2. Add content validation in `QuestDefinitionValidator.ts`.
3. Add pure matching/reduction logic in `QuestEngine.ts`; retain exactly-one-stage
   advancement.
4. Publish the event only from the server system that owns the fact. Combat owns
   deaths, inventory owns grants, and dialogue owns completed conversations.
5. Update the sanitized view model only if presentation needs additional fields.
6. Update both sides of `QuestRemoteProtocol.ts` for network-shape changes.
7. Update `QuestProfileCodec.ts` and Convex validation only when persisted state
   changes; bump `QUEST_PROFILE_SCHEMA_VERSION` and supply a migration.
8. Add exhaustive Roblox tests for matching, non-matching, deduplication, caps,
   stage boundaries, multiple quests, and malformed events.

Adding a union member should intentionally produce compiler errors in every switch
or handler that needs to understand it. Resolve those errors explicitly; do not
silence them with casts or `any`.

## Persistence lifecycle

Published servers and published places tested in Studio select Convex. Studio uses
`prestigious-crab-721`; live servers use `grand-basilisk-273`. Unpublished places
without an explicit backend use memory.

The lifecycle is:

1. Acquire a Convex lease and revision.
2. Optionally import a legacy DataStore record while migration is pending.
3. Decode and validate the profile before exposing it to gameplay.
4. Start configured auto-start quests.
5. Load or initialize inventory state inside the same aggregate profile.
6. Autosave every 60 seconds, renewing the 180-second lease.
7. Atomically save both domains and release when the player leaves or server closes.

Retryable failures use capped exponential backoff. Revision or session conflicts are
terminal because overwriting would risk data loss. Never silently fall back from
Convex to another persistent backend during an outage.

## Networking and UI

`QuestRemoteService` sends full current snapshots rather than accepting progress
deltas from the client. This is simple, deterministic, and appropriate for the
current profile size. Revisit replication only after measurements show snapshots are
materially expensive.

The compact `QUESTS` control sits at `(18, 136)`, directly below the Inventory
control. Its expanded tracker uses a bounded scrolling area, so the active-quest
limit cannot run the UI off-screen. `MORE QUESTS` opens a centered journal with
Active and All tracked-quest filters, a scrolling list, and selected quest detail.
The journal includes completed quest IDs only when an installed definition can
safely provide display text; it does not reveal untracked future definitions.

The HUD uses Roblox safe-area insets and responsive size constraints. Inventory and
the quest journal close one another, and combat input is suppressed while either
modal is open. Test zero, one, multiple, overflow, active, and completed states.
Treat all received payloads as unknown until parsed by `parseQuestServerMessage`.

## Tests and quality gates

```bash
npm run build                 # strict roblox-ts compilation
npm run test:build            # compile and build the Roblox test place
npm test                      # Roblox Jest runtime suite (requires a backend)
npm run test:coverage         # Roblox coverage thresholds
npm run test:convex:coverage  # Convex transaction/API coverage thresholds
npm run build:place           # production Rojo place build
npm run format:check
```

Keep gameplay, Instance, CollectionService, RemoteEvent, GUI, and Roblox adapter
tests in `*.spec.ts` so they execute in Roblox. Convex-only functions use
`convex-test`. A command that merely builds `test.rbxl` does not prove that runtime
tests executed; verify the runner reports actual test counts.

Every bug fix should add a regression test at the public boundary that failed. Use
injected repositories, transports, clocks, and sleepers instead of network calls or
production data in deterministic suites.

## Agent checklist

Before changing the system:

- Read this guide, the design document, testing guide, and database guide when
  applicable.
- Inspect the working tree and preserve unrelated user changes.
- Identify which layer owns the fact or behavior being changed.

Before handing off:

- Validate all shipped definitions.
- Confirm clients still cannot author progress.
- Confirm persistence failures never replace data with an empty profile.
- Confirm stage-completing events do not spill into the next stage.
- Confirm profile schema and Convex validators agree.
- Run strict builds, relevant Roblox tests, Convex tests, and both Rojo builds.
- Report any unavailable test backend honestly.

## Known extension boundaries

- Quest content currently lives under `src/shared`; before adding hidden future
  story stages, move production definitions into a server-only content registry and
  retain separate shared test fixtures.
- The current objective handler is collectible-only. Enemy and conversation support
  should use the extension procedure above.
- Completion is immediate. Turn-in and rewards require an idempotent reward service
  and a persisted ready-to-turn-in lifecycle.
- Journal selection is client-local and resets on a new session. Persistent pinning
  requires a separate server-validated preference design; do not store it in quest
  progression state by accident.

## Code-review follow-ups

These are known hardening items, not features that are already implemented:

- Put explicit size limits on processed source IDs, active quests, completed quests,
  stages, and objectives. A `CollectItem` requirement can currently be as high as one
  million, and every contributing source ID is persisted in the profile.
- Add dirty tracking and a lease-renewal path before scaling concurrency materially.
  The current 60-second autosave writes and increments the revision even when a player
  has no changed quest state.
- Bound or scroll the HUD content before enabling large numbers of simultaneous quests;
  the current automatically sized tracker can extend beyond a short viewport.
- Decide how duplicate collectible IDs recover. A duplicate is correctly rejected, but
  the rejected tagged Instance is not automatically promoted when the registered one is
  removed.
