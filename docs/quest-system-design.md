# Quest System Design

Status: production architecture with an initial collectible quest delivery
Theme: mythic ancient Greece / demigod odyssey  
Implementation direction: TypeScript with `roblox-ts`

## 1. Vision

Quests are the narrative spine of the game. They should carry the player from local
human problems—bandits, missing offerings, dangerous roads—into conflicts with
monsters, gods, curses, and the consequences of being a demigod.

The first system must support:

- Eliminating one enemy type.
- Eliminating several different enemy types in the same quest.
- Collecting a specific item and quantity.
- Talking to a specific NPC or completing a specific conversation.
- Combining several objectives that can progress together.
- Chaining ordered steps so later events do not count early.
- Saving progress and resuming after reconnecting.
- Updating a journal and pinned quest tracker.

The architecture should make a new quest primarily a **data-authoring task**, not a
new set of scripts.

### Current collectible implementation

The production core currently implements `CollectItem` objectives through tagged
world objects:

- Tag the collectible Instance with `QuestCollectible` through CollectionService.
- Set `QuestCollectibleId` to a globally stable, unique source ID.
- Set `QuestItemId` to the item definition ID used by the objective.
- Optionally set integer `QuestItemQuantity`; it defaults to `1` and is capped at
  `1000`.
- Use a `BasePart`, `Attachment`, or `Model` with a `PrimaryPart`, and place a
  `ProximityPrompt` below the tagged Instance.

`CollectibleRegistry` listens for existing, added, and removed tags and rejects
invalid metadata or duplicate stable IDs. `ProximityPromptService` provides the
interacting player on the server. The claim service derives item ID and quantity
from registered server Instances, checks the character distance, requires a loaded
profile, and emits the event into `QuestEngine`. A client cannot submit progress or
collectible metadata.

Processed source IDs are persisted per objective, progress is capped, and a
stage-completing event never spills into the next stage. The client receives
display-only quest snapshots and renders the current stage in `QuestHud`. The initial
sacred olive branch props were removed from `default.project.json` while the shared
place serves as an unobstructed Animation Lab; world collectibles can be authored
again when level design resumes.

Future inventory grants, enemy drops, NPC conversations, and combat events should
normalize into the same authoritative engine boundary. They must not bypass
definition validation, profile ownership, deduplication, or server-to-client
view-model construction.

### Current persistence implementation

Published servers persist quest profiles in Convex through an authenticated,
server-only HTTP adapter. Per-profile leases prevent two Roblox servers from loading
the same player concurrently; revision checks and idempotency keys make retries safe;
and player removal atomically saves and releases ownership. Existing
`PlayerQuestProfiles_v1` records migrate once through an explicit pending/complete
marker. Unpublished places use memory unless configured otherwise. Read
[`player-database.md`](./player-database.md) before changing persistence or adding
another persistent player domain.

## 2. Production baseline decisions

These are the default rules for the initial implementation:

1. A quest contains an ordered list of **stages**.
2. A stage contains one or more **objectives**.
3. All objectives in the current stage are active and progress in parallel.
4. Every objective in the stage must be complete before the next stage starts.
5. Only the current stage listens for progress. An event that completes one stage
   never spills over and also counts for the next stage.
6. The server is authoritative for accepting, progressing, turning in, completing,
   saving, and rewarding quests.
7. The client may request actions and display state, but it never reports a kill,
   item collection, conversation completion, or progress number.
8. Initial quests are one-time quests. Repeatable quests, branching paths, failure
   states, and timers are later extensions.
9. Quest definitions are immutable and identified by stable string IDs.
10. Multiple quests may be active at once, although the UI only needs to pin one
    quest initially.

This gives us simple composition:

```text
Quest
├── Stage 1: Talk to the temple guard
├── Stage 2: Eliminate 3 Grave Robbers AND 1 Robber Captain
├── Stage 3: Collect 3 Sacred Marble Shards
└── Turn in to the priestess
```

Objectives on Stage 2 progress together. Stages 1, 2, and 3 remain strictly ordered.

## 3. Player-facing lifecycle

```text
Locked
  ↓ prerequisite completed
Available
  ↓ accepted from a quest giver
Active: Stage 1
  ↓ all Stage 1 objectives complete
Active: Stage 2 ... Stage N
  ↓ final stage complete
Ready to turn in
  ↓ valid conversation with turn-in NPC
Completed + rewards granted
```

### Locked

The player cannot accept the quest. In the initial production delivery, a quest is
locked only when its prerequisite quest has not been completed. Level, reputation,
divine favor, and world state requirements can be added later.

### Available

The quest giver displays an available marker. Interacting opens an offer containing
the title, premise, first objective, and rewards. The client requests acceptance;
the server verifies the NPC, distance, availability, prerequisites, and that the
quest is not already active or completed.

### Active

Only the current stage is shown in the tracker and listens for events. Completed
stages are implicit from `currentStageIndex`; they do not need to retain every old
counter.

### Ready to turn in

The turn-in NPC receives a completion marker. Interacting lets the server validate
the quest one last time, grant rewards exactly once, record completion, and remove
the active state.

### Completed

The stable quest ID is recorded in the player's completion history. This unlocks
follow-up quests and supports future journal/history views.

## 4. Objective semantics

Every objective has a stable ID unique within its quest. Progress is stored as a
number, including dialogue objectives (`0` or `1`), which keeps state and UI updates
uniform.

### Eliminate an enemy

Fields:

- Enemy definition ID, not the NPC model name or instance path.
- Required count greater than zero.
- Credit rule.
- Player-facing description.

The authoritative combat/enemy system emits exactly one defeated event when an enemy
dies. Quest code never watches `Humanoid.Died` independently and never trusts a
client kill notification.

Recommended baseline credit rule: every nearby player who made meaningful, recent
damage contributions receives credit. This is fairer than last-hit-only credit and
works when two players fight one enemy. The exact contribution window, minimum
damage, and distance should live in configuration. Party-wide credit can be added
later.

To require different enemies, put several eliminate objectives in the same stage:

```text
[2 / 3] Grave Robbers
[0 / 1] Grave Robber Captain
```

### Collect an item

Fields:

- Item definition ID.
- Required quantity greater than zero.
- Which server-authoritative acquisition sources are eligible.
- Player-facing description.

In the initial production delivery, “collect” means cumulative acquisition while
that objective is active. The Inventory/Loot service publishes an `ItemGranted`
event with a unique transaction ID, item ID, quantity, and source. Eligible sources
might include an enemy drop, world pickup, or quest grant. Moving an existing item
between inventory slots, dropping and picking up a transferred item, or a client
claim must not manufacture new progress.

The counter is capped at the requirement and does not decrease if the player later
uses the item. A future `PossessItem` objective can require the player to currently
hold items and optionally consume them during turn-in; that more complicated behavior
does not need to be part of the first slice.

### Talk to an NPC

Fields:

- Stable NPC definition ID.
- Optional conversation/node ID.
- Player-facing description.

Progress occurs after the server validates the interaction distance and the required
conversation reaches its completion node. Merely opening a dialogue panel is not
enough. Requiring a conversation ID prevents an unrelated line from the same NPC
from satisfying the objective.

Accepting or turning in a quest is a lifecycle action, not automatically a talk
objective. A designer adds a `TalkToNpc` objective only when that conversation is an
intentional story step.

## 5. TypeScript content model

The definitions should use a discriminated union. Adding a new objective kind later
then creates compile errors in every reducer, validator, and UI formatter that must
handle it.

```ts
type QuestId = string;
type QuestStageId = string;
type QuestObjectiveId = string;
type EnemyTypeId = string;
type ItemId = string;
type NpcId = string;
type ConversationId = string;

interface ObjectiveBase {
	readonly id: QuestObjectiveId;
	readonly description: string;
}

interface EliminateEnemyObjective extends ObjectiveBase {
	readonly kind: "EliminateEnemy";
	readonly enemyTypeId: EnemyTypeId;
	readonly required: number;
	readonly credit: "Contributor" | "FinalBlow";
}

interface CollectItemObjective extends ObjectiveBase {
	readonly kind: "CollectItem";
	readonly itemId: ItemId;
	readonly required: number;
	readonly eligibleSources: ReadonlyArray<
		"EnemyDrop" | "WorldPickup" | "QuestGrant"
	>;
}

interface TalkToNpcObjective extends ObjectiveBase {
	readonly kind: "TalkToNpc";
	readonly npcId: NpcId;
	readonly conversationId?: ConversationId;
}

type QuestObjectiveDefinition =
	| EliminateEnemyObjective
	| CollectItemObjective
	| TalkToNpcObjective;

interface QuestStageDefinition {
	readonly id: QuestStageId;
	readonly title: string;
	readonly narrative: string;
	readonly objectives: ReadonlyArray<QuestObjectiveDefinition>;
}

interface QuestRewardDefinition {
	readonly experience?: number;
	readonly drachmae?: number;
	readonly items?: ReadonlyArray<{
		readonly itemId: ItemId;
		readonly quantity: number;
	}>;
}

interface QuestDefinition {
	readonly id: QuestId;
	readonly version: number;
	readonly title: string;
	readonly summary: string;
	readonly giverNpcId: NpcId;
	readonly turnInNpcId: NpcId;
	readonly prerequisiteQuestIds: ReadonlyArray<QuestId>;
	readonly stages: ReadonlyArray<QuestStageDefinition>;
	readonly rewards: QuestRewardDefinition;
}
```

These aliases can become branded string types later if accidental ID mixing becomes
a real problem. Stable IDs should use lowercase snake case and must never be changed
only to improve display text; saves and cross-system references depend on them.

## 6. Example Greek quest

The first production slice can be **The Broken Offering**. It exercises every
baseline objective without requiring a boss, branching dialogue, or unusual world
logic.

Premise: thieves desecrated a roadside shrine and carried fragments of its sacred
relief into a sealed ruin. Priestess Thaleia asks the player to investigate. The
temple guard directs the player to the raiders, and defeating their captain opens the
path to recover the fragments.

```ts
const brokenOffering = {
	id: "the_broken_offering",
	version: 1,
	title: "The Broken Offering",
	summary: "Recover the pieces of a sacred relief stolen from Thaleia's shrine.",
	giverNpcId: "priestess_thaleia",
	turnInNpcId: "priestess_thaleia",
	prerequisiteQuestIds: [],
	stages: [
		{
			id: "seek_the_guard",
			title: "A Witness at the Gate",
			narrative: "Nikandros saw the thieves flee toward the old road.",
			objectives: [
				{
					id: "talk_to_nikandros",
					kind: "TalkToNpc",
					npcId: "guard_nikandros",
					conversationId: "broken_offering_directions",
					description: "Speak with Nikandros at the temple gate",
				},
			],
		},
		{
			id: "break_the_raiders",
			title: "Thieves on the Old Road",
			narrative: "Drive the shrine robbers from the ruined waystation.",
			objectives: [
				{
					id: "defeat_grave_robbers",
					kind: "EliminateEnemy",
					enemyTypeId: "grave_robber",
					required: 3,
					credit: "Contributor",
					description: "Defeat Grave Robbers",
				},
				{
					id: "defeat_robber_captain",
					kind: "EliminateEnemy",
					enemyTypeId: "grave_robber_captain",
					required: 1,
					credit: "Contributor",
					description: "Defeat the Grave Robber Captain",
				},
			],
		},
		{
			id: "restore_the_relief",
			title: "Fragments of the Divine",
			narrative: "The captain's fall has opened the sealed shrine chamber.",
			objectives: [
				{
					id: "collect_marble_shards",
					kind: "CollectItem",
					itemId: "sacred_marble_shard",
					required: 3,
					eligibleSources: ["WorldPickup"],
					description: "Collect Sacred Marble Shards",
				},
			],
		},
	],
	rewards: {
		experience: 250,
		drachmae: 75,
		items: [{ itemId: "thaleias_blessing", quantity: 1 }],
	},
} as const satisfies QuestDefinition;
```

This quest naturally teaches the game loop:

1. Follow a marker and interact with a named character.
2. Fight ordinary enemies and a stronger variant.
3. Enter the newly safe space and explore for quest objects.
4. Return to the original quest giver for story closure and a divine reward.

The shrine chamber should become accessible from server-owned world state when the
combat stage completes. Because physical geometry is shared by everyone in a server,
the door opening can be a communal reaction; each marble pickup still validates that
the interacting player has the correct active stage. This is world presentation and
progression integration, not another client-controlled quest update.

## 7. Runtime state

Definitions describe content shared by every player. Runtime state contains only one
player's changing progress:

```ts
type ActiveQuestStatus = "Active" | "ReadyToTurnIn";

interface ActiveQuestState {
	readonly questId: QuestId;
	readonly definitionVersion: number;
	readonly status: ActiveQuestStatus;
	readonly currentStageIndex: number;
	readonly objectiveProgress: Readonly<Record<QuestObjectiveId, number>>;
	readonly startedAt: number;
	readonly stageStartedAt: number;
	readonly updatedAt: number;
}

interface PlayerQuestSaveData {
	readonly schemaVersion: number;
	readonly activeQuests: Readonly<Record<QuestId, ActiveQuestState>>;
	readonly completedQuestIds: ReadonlyArray<QuestId>;
}
```

Only progress for the current stage needs to be stored. On stage transition, create
a fresh progress record for the next stage. Completed stages are known because their
index is lower than `currentStageIndex`.

`definitionVersion` is not the save schema version. It identifies a content revision
for one quest. If a live update changes required counts, removes a stage, or changes
an objective ID, a migration must translate saved progress or intentionally reset
that quest with compensation. Text-only edits do not require a version bump.

## 8. Authoritative domain events

QuestService should subscribe to typed, server-only facts published by the systems
that own them:

```ts
type QuestProgressEvent =
	| {
			readonly kind: "EnemyDefeated";
			readonly eventId: string;
			readonly enemyInstanceId: string;
			readonly enemyTypeId: EnemyTypeId;
			readonly contributorUserIds: ReadonlyArray<number>;
	  }
	| {
			readonly kind: "ItemGranted";
			readonly eventId: string;
			readonly userId: number;
			readonly itemId: ItemId;
			readonly quantity: number;
			readonly source: "EnemyDrop" | "WorldPickup" | "QuestGrant";
	  }
	| {
			readonly kind: "ConversationCompleted";
			readonly eventId: string;
			readonly userId: number;
			readonly npcId: NpcId;
			readonly conversationId: ConversationId;
	  };
```

Event sources:

- `EnemyService`/`DamageService` publishes `EnemyDefeated` once after authoritative
  death resolution and supplies the contributor ledger.
- `InventoryService`/`LootService` publishes `ItemGranted` after it successfully
  applies a unique server transaction.
- `DialogueService` publishes `ConversationCompleted` after it validates the NPC,
  player distance, and conversation end node.

QuestService fans an event out only to affected players and active quests, passing
the affected player's user ID into the reducer. It keeps a bounded, per-session cache
of processed event IDs as a second line of defense against duplicate publications.
These systems should not call quest-specific functions such as
`IncrementBrokenOfferingRobbers()`. They publish reusable facts, leaving quest data
to decide whether those facts matter.

## 9. Progress reducer

The heart of the system should be a pure function:

```ts
interface QuestTransition {
	readonly state: ActiveQuestState;
	readonly changedObjectiveIds: ReadonlyArray<QuestObjectiveId>;
	readonly stageCompleted: boolean;
	readonly questReadyToTurnIn: boolean;
}

function applyQuestEvent(
	definition: QuestDefinition,
	state: ActiveQuestState,
	playerUserId: number,
	event: QuestProgressEvent,
): QuestTransition;
```

The reducer:

1. Ignores events when the quest is not `Active`.
2. Reads only `definition.stages[state.currentStageIndex]`.
3. Matches the event against objectives by kind and stable target ID.
4. Confirms that this player is eligible and that the event source is allowed.
5. Increments progress without exceeding `required`.
6. Marks the stage complete only when all its objectives meet their requirements.
7. Advances exactly one stage and initializes its counters, or marks the quest
   `ReadyToTurnIn` after the final stage.
8. Does not apply the completing event a second time to the newly active stage.

Keeping this logic pure makes most quest behavior testable without Players,
DataStores, NPC models, RemoteEvents, or a running Studio server.

QuestService remains responsible for orchestration: loading definitions, validating
accept/abandon/turn-in requests, calling the reducer, persisting state, emitting
world reactions, and replicating safe views to the client.

## 10. Proposed module layout

This layout assumes the TypeScript migration described in the project TypeScript
guide has happened:

```text
src/
├── client/
│   └── quests/
│       ├── QuestController.ts
│       ├── QuestJournalController.ts
│       ├── QuestMarkerController.ts
│       └── QuestTrackerController.ts
├── server/
│   ├── quests/
│   │   ├── QuestService.ts
│   │   ├── QuestReducer.ts
│   │   ├── QuestDefinitionValidator.ts
│   │   ├── QuestRepository.ts
│   │   ├── QuestDefinitions.ts
│   │   └── quests/
│   │       └── TheBrokenOffering.ts
│   └── services/
│       ├── DialogueService.ts
│       ├── InventoryService.ts
│       ├── RewardService.ts
│       └── WorldStateService.ts
└── shared/
    ├── quests/
    │   ├── QuestTypes.ts
    │   └── QuestClientTypes.ts
    └── net/
        └── QuestRemotes.ts
```

Full quest definitions should remain server-side. The server sends a sanitized
`QuestClientView` containing only the visible title, summary, current stage,
objective progress, reward preview, and marker state. This avoids exposing future
story beats and prevents the client bundle from becoming an alternate authority.

## 11. Definition validation

Validate the complete quest registry when the server starts. Fail fast in development
instead of discovering broken content halfway through a play session.

The validator should reject:

- Duplicate quest, stage, or objective IDs.
- Empty quests or stages.
- Counts that are zero, negative, non-integer, or otherwise invalid.
- Missing giver or turn-in NPC definitions.
- Missing enemy, item, conversation, or reward item definitions.
- Self-referential, missing, or circular prerequisites.
- Duplicate target objectives in one stage when their behavior would be ambiguous.
- A definition version that is not a positive integer.
- Unsupported event sources or credit policies.

Warnings can flag unusually large counts, an NPC used before it is available in the
world, or a quest whose giver and prerequisite progression appear unreachable.

## 12. Integration boundaries

### Combat and enemies

The combat plan already calls for server-owned damage and death handling. Add a
single typed defeat event after death credit is finalized. The event includes the
enemy definition ID used by quest data, not a display name. A unique death/event ID
prevents the same NPC death from being published twice during cleanup or respawn.

### Inventory and loot

QuestService observes successful item grants; it does not create loot or edit the
inventory directly. World pickups and enemy drops go through InventoryService so
they receive authoritative transaction IDs. Quest-only items may be hidden from
normal trading/dropping rules to keep the first implementation simple.

### Dialogue and NPCs

NPC interaction begins on the client for responsiveness, but the server validates
distance and which conversation is currently legal. DialogueService decides that a
conversation completed and publishes that fact. QuestService calculates whether the
NPC offers a quest, advances an objective, or permits turn-in.

### Rewards and progression

QuestService submits a reward bundle to RewardService using a stable idempotency key
derived from the player and quest completion. Retrying a save or turn-in must never
grant the bundle twice. XP, drachmae, inventory items, abilities, divine favor, and
future world flags belong to their owning services.

### World reactions

Stage transitions can emit named server events such as
`the_broken_offering:raiders_defeated`. WorldStateService may unlock a door, change
NPC dialogue, or start a presentation sequence. These reactions should be explicit
definition hooks or registered handlers, not hidden side effects inside the reducer.

## 13. Persistence and idempotency

Quest state should load with the rest of the player's server profile before offers
or progress events are processed. While loading, queue or reject interactions rather
than creating an unsaved second state.

Persistence rules:

- Save stable IDs and counters, never Roblox Instances or full definitions.
- Clamp and validate loaded progress against the current definition.
- Keep a schema version for player quest data and a definition version per active
  quest.
- Mark state dirty on accept, stage transition, abandon, and turn-in; ordinary
  counter changes can use the profile system's normal autosave cadence.
- Flush through the profile/save service when a player leaves and during shutdown.
- Use idempotent reward grants and completion records so retrying turn-in is safe.
- If an active definition is missing or incompatible, quarantine it for migration;
  do not crash the whole player profile.

Abandoning may be included in the initial delivery if needed. The recommended rule
is that abandoning deletes active progress and accepting again starts from Stage 1.
Quest-only items should be removed or safely orphaned according to InventoryService
policy.

## 14. Networking and security

Client-to-server requests:

- `RequestAcceptQuest(questId, npcId)`
- `RequestAbandonQuest(questId)`
- `RequestTurnInQuest(questId, npcId)`

Dialogue interaction itself should use the dialogue/NPC remote, not a quest progress
remote. There is deliberately no `ReportKill`, `ReportItemCollected`,
`CompleteObjective`, or arbitrary progress request.

For every request, the server validates:

- Payload types and known IDs.
- Player/profile readiness.
- Request rate.
- Current quest status.
- Prerequisites and completion history.
- NPC identity, availability, and player distance when relevant.
- That a reward or transition has not already been processed.

Server-to-client messages:

- Initial quest snapshot after profile load.
- Quest accepted/removed view.
- Objective progress delta.
- Stage changed view.
- Ready-to-turn-in state.
- Quest completed and reward presentation.
- NPC marker/offer updates if those cannot be derived locally.

Send presentation facts, not server-only definitions or internal event data.

## 15. Initial UI and experience

The production UI should include:

- A dialogue quest offer with Accept and Decline.
- A compact pinned tracker showing the quest title and current objectives.
- Progress updates such as `Grave Robbers 2 / 3`.
- A short stage-complete transition and new-stage text.
- World-space markers for available, active-talk, and ready-to-turn-in NPCs.
- A simple journal listing active and completed quests.
- A quest-complete moment that shows rewards without blocking control for too long.

Suggested marker language:

- Gold `!`: new quest available.
- White/gold diamond: NPC is the current talk target.
- Gold `?`: quest is ready to turn in.
- No marker: locked, irrelevant, or already completed.

The tracker should describe what the player can do now and avoid revealing hidden
future stages. On controller/mobile, quest interaction must use the same abstract
interaction action as other NPC conversations.

## 16. Edge-case rules

Set these rules early so content behaves consistently:

- Kills before a stage becomes active never count retroactively.
- Items already owned before a `CollectItem` stage do not count for cumulative
  acquisition; only eligible grants after stage activation count.
- One event may update multiple active quests, but at most the matching objectives
  in each quest's current stage.
- Counters never exceed their required values.
- A dead enemy emits one defeat event, even if several damage/death listeners run.
- A disconnected contributor receives no new in-memory update. If cross-server or
  post-disconnect credit becomes important, design it separately rather than writing
  directly to another player's DataStore.
- NPCs with identical display names still require different stable IDs.
- Respawned enemies reuse an enemy type ID but receive a new instance/death event ID.
- Turning in twice or retrying after a timeout grants rewards once.
- A definition update never silently interprets one objective ID as a different
  objective.

## 17. Test strategy

### Pure reducer tests

- Correct enemy increments the correct objective.
- Wrong enemy and ineligible player do nothing.
- Two enemy types progress independently in one stage.
- Progress caps at the required count.
- A stage advances only after all objectives complete.
- The event completing a stage does not count toward the next stage.
- Wrong item/source, NPC, or conversation does nothing.
- Final stage enters `ReadyToTurnIn`, not `Completed`.
- Events do nothing after ready-to-turn-in.

### Definition tests

- Every shipped quest passes registry validation.
- Missing referenced IDs fail with a useful path and message.
- Duplicate IDs and circular prerequisites fail deterministically.

### Server integration tests

- Accept and turn-in distance checks reject spoofed requests.
- Combat emits one defeat event and credits eligible contributors.
- Inventory grants are deduplicated by transaction ID.
- Dialogue completes only the intended objective.
- Reconnecting restores stage and counters.
- Two active quests can observe one relevant event correctly.
- Two-player combat gives credit according to the configured policy.
- Reward retry and duplicate turn-in never double-grant.
- A malformed remote payload cannot mutate quest state.

### Playtest acceptance

The Broken Offering can be accepted, completed, turned in, saved, and resumed in both
solo and two-player Studio testing. Every marker and tracker update matches the
server state, and a tester cannot gain progress through client-only actions.

## 18. Delivery plan

### Phase 0 — TypeScript foundation

Complete the repository's roblox-ts migration before gameplay implementation. The
quest system must not be added as new Luau beside a planned TypeScript codebase.

### Phase 1 — Definitions and reducer

Create quest types, the registry, definition validator, runtime state, pure reducer,
and reducer tests. Author The Broken Offering as the fixture quest.

### Phase 2 — Server lifecycle and persistence

Implement accept, active-state management, stage transitions, turn-in, completion
history, reward idempotency, profile serialization, and safe client views.

### Phase 3 — System adapters

Connect authoritative combat defeat, inventory grant, and dialogue completion events.
Add the NPC and world-state hooks needed by the example quest.

### Phase 4 — Client experience

Build the quest offer, journal, pinned tracker, NPC markers, progress feedback, stage
transitions, and reward presentation.

### Phase 5 — Multiplayer hardening

Test contribution credit, event deduplication, reconnects, rapid interactions,
definition migrations, remote abuse, and multiple simultaneous quests.

## 19. Deliberately deferred extensions

The stage/objective model can grow later without putting these into the first build:

- Branching dialogue and mutually exclusive quest paths.
- “Complete any N” or OR-group objectives.
- Timed objectives and explicit quest failure.
- Escort, defend, discover-location, craft, use-item, survive, and puzzle objectives.
- Party-shared quests and distance-based party credit.
- Repeatable bounties, daily/weekly quests, and procedural contracts.
- Hidden objectives and secret outcomes.
- Optional objectives and bonus rewards.
- Account-wide or world-wide quest state.
- Reputation, divine favor, alignment, and god-specific quest chains.
- Choice consequences that modify later NPCs, regions, or endings.

The key extension rule is to add a new discriminated objective type or an explicit
stage completion policy. Do not encode new behaviors in magic description strings or
one-off conditionals keyed to a quest title.

## 20. Final recommendation

Build one complete, polished quest before authoring a large quest catalog. The Broken
Offering should prove the whole loop from NPC offer to persistent reward while using
all three objective types and a multi-enemy stage. Once that slice is reliable,
creating a Greek odyssey becomes a content problem: new characters, regions, myths,
enemy definitions, items, conversations, and ordered stages assembled through the
same data model.

That foundation also leaves room for the larger ambition. A local shrine quest can
later unlock a monster hunt, earn the notice of a god, branch into rival divine
alliances, and eventually change the simulated world—without replacing the core
quest engine.
