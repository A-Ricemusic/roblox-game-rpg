# Weapon System Design

Status: spawn/equip and four-hit procedural light combo implemented  
First weapon: one-handed Greek sword, no shield  
Primary platform: mobile, with keyboard and mouse support for development  
Implementation direction: TypeScript with `roblox-ts`

## 1. Goal

The first weapon system should let a player spawn with a saved one-handed sword,
hold it correctly, and use responsive melee combat without Roblox `Tool` instances
or a large library of uploaded character animations.

The first playable slice supports:

- Equipping a one-handed sword from the player's saved inventory.
- Attaching the sword to an R15 character's right hand.
- A four-step light combo that can stop after any strike.
- A charged heavy attack produced by holding and releasing Attack.
- Hold-to-block behavior.
- Procedural character poses and transitions.
- Server-authoritative attack timing, hit detection, blocking, damage, and death.
- Touch controls designed first, with mouse and keyboard equivalents.
- A weapon asset contract that can later support two-handed weapons, shields, bows,
  and other weapon families without replacing the core system.

The first slice does not include shields, parrying, dodging, stamina, durability,
weapon upgrades, elemental effects, loot drops, or player-versus-player damage.
Those features should fit the architecture later but are not MVP requirements.

## 2. Core design decisions

1. Weapons are not Roblox `Tool` instances and never enter the Backpack.
2. A weapon consists of a visual model, semantic attachments, and a typed gameplay
   definition.
3. The initial sword model is authored or imported in Studio and stored under
   `ReplicatedStorage/Assets/Weapons`.
4. Attachment locations, not model dimensions or pivots, define how the weapon is
   held and where its damaging section is located.
5. The primary hand owns the physical weapon connection through one custom
   `Motor6D`. Character body joints are separate and may be either modern
   `AnimationConstraint` objects or legacy `Motor6D` objects.
6. Character combat motion is produced by a reusable procedural pose engine.
7. Each client animates combatants locally from replicated action events; the server
   does not stream joint transforms every frame.
8. The server independently owns combat state and resolves hits. A client never
   reports its damage, chosen victim, hit result, or combo step.
9. Saved inventory data contains stable weapon IDs and progression data, never Roblox
   instances, attachment transforms, or asset paths.
10. Weapon-specific numbers and moves live in definitions rather than service code.

## 3. First weapon: Hoplite Sword

The working ID for the starter sword is `hoplite_sword`. The visual direction can be
a simple Greek xiphos-style short sword; the ID does not need to change if its model
is replaced later.

### Intended moveset

| Action | Player input | Motion | Initial gameplay role |
| --- | --- | --- | --- |
| Light 1 | Tap Attack | Fast diagonal cut | Safe opener |
| Light 2 | Tap during combo window | Rising left-to-right diagonal | Combo continuation |
| Light 3 | Tap during combo window | Forward step and thrust | Committed stab |
| Light 4 | Tap during combo window | 360-degree spinning slash | Combo finisher |
| Heavy | Hold Attack, then release | Draw back and forceful forward/downward cut | Slow, high damage |
| Block | Hold Block | Raise sword into defensive position | Reduces valid frontal damage |

A single tap followed by no additional input is naturally a one-strike combo. Four
correctly timed taps produce the complete combo, after which the sequence wraps.
The system does not need separate one-strike and three-strike abilities.

Initial tuning values are placeholders and should be adjusted in playtests:

| Property | Suggested starting value |
| --- | --- |
| Light damage | 14 / 16 / 22 |
| Heavy damage | 28 at minimum charge, up to 40 |
| Heavy hold threshold | 0.35 seconds |
| Full heavy charge | 1.25 seconds |
| Combo input buffer | 0.20 seconds |
| Combo reset window | 0.75 seconds |
| Block damage reduction | 70% from the front |
| Block coverage | 120-degree frontal arc |

## 4. Weapon asset contract

The sword should be placed in Studio using this shape:

```text
ReplicatedStorage
└── Assets
    └── Weapons
        └── HopliteSword
            ├── WeaponRoot                   PrimaryPart
            │   ├── PrimaryGrip              Attachment
            │   ├── HitboxStart              Attachment
            │   ├── HitboxEnd                Attachment
            │   └── Tip                      Attachment, optional for MVP
            └── Visual geometry              MeshParts and/or Parts
```

### WeaponRoot

`WeaponRoot` is the model's `PrimaryPart`. It may be the sword's primary MeshPart or
a small invisible Part. Using an invisible root is often easier for imported assets
whose pivot is inconvenient.

It should be:

- Unanchored when cloned onto a character.
- Non-collidable, non-queryable, and non-touchable.
- Massless.
- Connected to all visible parts with welds if the sword contains multiple parts.
- Free of scripts, remotes, constraints, sounds, or unrelated Toolbox content.

Visual weapon geometry never supplies authoritative collision. It can therefore be
decorative without making combat less reliable.

### PrimaryGrip

`PrimaryGrip` marks the exact point and orientation where the right palm holds the
sword. This is the important mathematical reference for placement. The model's
center, bounding box, and pivot do not determine the grip.

During equip, the system aligns `PrimaryGrip` with the R15 character's right-hand
grip attachment and creates a `Motor6D` between `RightHand` and `WeaponRoot`.

If the sword looks misplaced, a developer adjusts `PrimaryGrip` visually in Studio.
No gameplay code or hard-coded weapon offset should need to change.

### HitboxStart and HitboxEnd

These attachments mark the damaging blade section:

```text
handle ── guard ── HitboxStart ═══════════ HitboxEnd
                         damaging blade
```

For the first sword:

- `HitboxStart` sits just above the guard at the base of the blade.
- `HitboxEnd` sits near the blade tip, slightly inside the visible geometry.
- `Tip` sits at the exact visual tip and is useful for effects or thrust attacks.

The attachments are reference points, not colliders. During an active attack, the
server samples the blade's previous and current positions and queries the swept area.
This avoids missed hits from fast motion and the unpredictability of `Touched`.

### Asset validation

On startup in development builds, an asset validator should report clear errors when:

- The model or `WeaponRoot` is missing.
- `WeaponRoot` is not the model's `PrimaryPart`.
- A required attachment is missing or duplicated.
- An attachment is outside a reasonable distance from the weapon bounds.
- A visible part is anchored or not connected to the root.
- A script or unexpected executable object exists in the asset.

This turns most weapon setup mistakes into immediate Studio warnings.

## 5. Future weapon compatibility

All weapons use named semantic attachments, but each weapon family declares which
ones it requires.

| Grip style | Primary owner | Additional markers | Examples |
| --- | --- | --- | --- |
| `OneHanded` | Right hand | `PrimaryGrip` | Sword, dagger, mace |
| `TwoHanded` | Primary hand | `SecondaryGrip` | Spear, trident, greatsword |
| `WeaponAndShield` | One root per hand | Shield grip/brace markers | Sword and shield |
| `Bow` | Bow hand | String, draw, and projectile markers | Bow and arrow |

The secondary hand should normally follow a target attachment procedurally rather
than being rigidly welded to a two-handed weapon. This prevents two independent arm
chains from fighting over the same model.

The first implementation only needs `OneHanded`, but the shared type and asset
validator should not assume every future weapon has exactly the sword's markers.

## 6. Inventory and spawn flow

Saved data uses stable IDs:

```ts
interface WeaponInventoryEntry {
    readonly weaponId: string;
    upgradeLevel: number;
}

interface PlayerEquipmentData {
    weapons: WeaponInventoryEntry[];
    equippedMainHand?: string;
}
```

Example persisted data:

```ts
{
    weapons: [
        { weaponId: "hoplite_sword", upgradeLevel: 1 },
    ],
    equippedMainHand: "hoplite_sword",
}
```

The spawn sequence is:

```text
Player joins
  ↓
Server loads and validates inventory
  ↓
New player receives hoplite_sword if no valid weapon exists
  ↓
Server selects the validated equipped weapon ID
  ↓
Character spawns and combat state is initialized
  ↓
Clients are told which weapon appearance to equip
  ↓
Sword is cloned, aligned at PrimaryGrip, and attached to RightHand
```

The server's equipment state is authoritative. If a client requests an unowned or
unknown weapon ID, the request is rejected and the last valid weapon remains equipped.

DataStore integration should sit behind a profile/inventory service. Combat code
should ask the equipment service for the current weapon definition rather than read
saved data directly.

## 7. Mobile-first input

The mobile HUD should provide two primary combat buttons:

```text
                         ┌───────────────┐
                         │    ATTACK     │
                         │ tap / hold    │
                         └───────────────┘
                    ┌───────────┐
                    │   BLOCK   │
                    │   hold    │
                    └───────────┘
```

Exact placement must avoid Roblox's thumbstick, jump button, device safe areas, and
other core UI. Buttons should scale with viewport size and provide pressed, charging,
queued, and cooldown feedback.

### Attack gesture

1. Finger down begins measuring the hold duration.
2. Releasing before the heavy threshold requests a light attack.
3. Crossing the threshold changes the button and character pose to charging.
4. Releasing after the threshold requests a heavy attack with bounded charge time.
5. Canceling the touch or entering an invalid state cancels the pending gesture.

Light attacks occur on release rather than initial press so the system can distinguish
a tap from a hold. The local wind-up can begin subtly on press to reduce perceived
delay, but it must blend cleanly into either the light or heavy action.

### Block gesture

Block begins when the Block button is pressed and ends when the finger releases,
leaves the button, the character is staggered, or another exclusive action begins.
The button remains visibly active while blocking.

### Development controls

| Input | Action |
| --- | --- |
| Left mouse tap | Light attack |
| Hold and release left mouse | Heavy attack |
| Right mouse or `F` held | Block |

All device bindings feed abstract actions such as `AttackPressed`, `AttackReleased`,
`BlockPressed`, and `BlockReleased`. Combat controllers should never contain separate
gameplay logic for touch and mouse.

## 8. Combat state model

The server owns one explicit state per combatant:

```text
Idle
├── LightWindup → LightActive → LightRecovery → Idle / next combo step
├── HeavyCharging → HeavyActive → HeavyRecovery → Idle
├── Blocking → Idle
├── Staggered → Idle
└── Dead
```

Important rules:

- A combatant cannot attack while dead, staggered, or already committed to an
  incompatible action.
- A light input received inside the combo buffer may queue the next strike.
- Waiting past the combo window resets the combo to strike one.
- Starting a block resets the light combo.
- A heavy attack cannot be released before the configured minimum threshold.
- Charge time is capped; holding longer does not create unlimited damage.
- Every swing records targets already hit so one target is damaged at most once.
- State transitions have server timestamps so clients can render the same action.

The local player's client predicts presentation immediately, but an authoritative
server rejection must blend the character back to the server state.

## 9. Procedural animation system

The goal is to avoid authoring and uploading a unique AnimationTrack for every attack.
Procedural animation is built from reusable poses, timed phases, and blending curves.

### Pose definition

A pose contains offsets for selected R15 joints rather than a keyframe for every body
part. Unspecified joints retain locomotion or their neutral offset.

```ts
interface ProceduralPose {
    readonly waist?: CFrame;
    readonly neck?: CFrame;
    readonly rightShoulder?: CFrame;
    readonly leftShoulder?: CFrame;
    readonly rightHip?: CFrame;
    readonly leftHip?: CFrame;
    readonly weaponGrip?: CFrame;
}
```

Reusable sword poses might include:

- `SwordIdle`
- `SwordBlock`
- `SwordLight1Windup` and `SwordLight1Strike`
- `SwordLight2Windup` and `SwordLight2Strike`
- `SwordLight3Windup` and `SwordLight3Strike`
- `SwordHeavyCharge` and `SwordHeavyStrike`
- `SwordHitReactionLeft` and `SwordHitReactionRight`

### Motion definition

An attack composes poses into phases:

```ts
interface MotionPhase {
    readonly poseId: string;
    readonly duration: number;
    readonly easing: "Linear" | "QuadIn" | "QuadOut" | "CubicInOut";
}

interface ProceduralMotion {
    readonly phases: readonly MotionPhase[];
}
```

The engine blends joint `Transform` offsets during `RunService.PreSimulation`. New
Roblox experiences use `AnimationConstraint` as the default R15 avatar joint through
the Avatar Joint Upgrade; older rigs may still use `Motor6D`. Both expose a
`Transform` suitable for procedural animation, but `AnimationConstraint:IsA("Motor6D")`
is false. Joint discovery must therefore support both classes rather than assuming
the shoulder is an `UpperTorso.RightShoulder` Motor6D.

The current compatibility adapter checks, in order:

- `AnimationConstraint`
- `Motor6D`
- `Bone`
- `Weld` or `ManualWeld`

On the playtested upgraded R15 avatar, `RightShoulder` is an
`AnimationConstraint` under `RightUpperArm`. The procedural controller locates it by
semantic joint name and connected body part, then writes its `Transform` during
`PreSimulation`. This ordering lets the Animator evaluate first and the procedural
combat pose layer afterward. Do not change rig-attachment `CFrame` values to animate
the character.

The combat pose layers over normal locomotion so the avatar can retain movement while
the upper body attacks. Strong attacks may temporarily influence the waist, hips, and
movement speed to create weight.

Procedural motion should include:

- Eased interpolation rather than constant-speed rotation.
- Small overshoot or spring settling on powerful strikes.
- Different upper- and lower-body influence weights.
- Smooth interruption into stagger or death.
- A reduced-motion option for camera shake and screen effects, not joint readability.

### Replication model

The initiating client begins its presentation immediately and sends an action request.
After validation, the server broadcasts an action ID, actor, authoritative start time,
and any required variation seed. Every observing client plays the same deterministic
motion locally at the correct time offset.

The server does not depend on rendered limb or weapon positions for damage. It uses
the weapon definition, authoritative character root transform, attack timing, and
configured query shape. This keeps combat valid even if animation rendering is late
or disabled.

## 10. Hit detection

The hit system uses a server-side swept blade query during each attack's active phase.

Conceptually:

1. Derive the expected `HitboxStart` and `HitboxEnd` positions from the authoritative
   character transform and weapon grip.
2. Compare the previous sample with the current sample.
3. Build one or more box, capsule-like, or raycast queries covering the space swept
   by the blade.
4. Resolve parts to valid combatants.
5. Filter the attacker, allies, dead actors, invulnerable targets, and targets already
   hit by this swing.
6. Apply damage through the central damage service.

`BasePart.Touched` is not used for weapon damage. The visible sword is non-collidable,
and clients never submit a target instance or hit position.

Each attack definition chooses its hit profile. A horizontal slash needs a wider
sweep, while a future thrust primarily traces the blade tip forward. This lets the
same sword attachments support different moves.

## 11. Blocking

Blocking is an authoritative state, not merely a defensive pose.

When damage is attempted, the server checks:

1. Is the defender alive and currently blocking?
2. Is the attacker inside the configured frontal block arc?
3. Is the incoming damage type blockable?
4. Has the block been broken or invalidated by stagger?

If valid, the initial sword block reduces damage rather than eliminating it. The
server broadcasts a block result so clients can play sparks, sound, a small recoil,
and mobile feedback.

The first version does not need perfect parries or stamina. These can later extend
the same damage pipeline with timing windows and guard resources.

## 12. Weapon definition

The shared definition is immutable content. A simplified form is:

```ts
interface WeaponDefinition {
    readonly id: string;
    readonly displayName: string;
    readonly assetName: string;
    readonly gripStyle: "OneHanded" | "TwoHanded" | "WeaponAndShield" | "Bow";
    readonly primaryHand: "Right" | "Left";
    readonly motionSetId: string;
    readonly lightCombo: readonly AttackDefinition[];
    readonly heavyAttack: ChargedAttackDefinition;
    readonly block: BlockDefinition;
}

interface AttackDefinition {
    readonly motionId: string;
    readonly windupSeconds: number;
    readonly activeSeconds: number;
    readonly recoverySeconds: number;
    readonly damage: number;
    readonly staggerSeconds: number;
    readonly hitProfileId: string;
}
```

The actual types should use branded IDs or precise unions where useful. Network
payloads still require runtime validation because TypeScript types do not secure a
Roblox RemoteEvent.

## 13. Client/server responsibilities

### Client

- Render the equipped sword model.
- Bind touch, mouse, and keyboard controls.
- Predict local poses and UI feedback.
- Render procedural animation for local and remote combatants.
- Display charge progress, combo availability, blocking state, hit effects, sound,
  trails, and optional camera feedback.
- Send only abstract action requests.

### Server

- Load and validate inventory and equipped weapon IDs.
- Own the combat state machine and authoritative timestamps.
- Validate action rate, order, charge duration, and legal state transitions.
- Resolve hit geometry and valid targets.
- Calculate blocks, damage, stagger, death, and future modifiers.
- Broadcast confirmed actions and outcomes.
- Rate-limit and log invalid remote traffic.

### Shared

- Weapon, motion, hit-profile, and combat configuration.
- Runtime payload validators and TypeScript types.
- Pure timing, angle, and geometry helpers safe on either side.

## 14. Proposed project organization

The exact paths can be refined during the TypeScript migration, but ownership should
remain clear:

```text
src/
├── client/
│   ├── controllers/
│   │   ├── combat-controller.ts
│   │   ├── equipment-visual-controller.ts
│   │   └── mobile-combat-controller.ts
│   └── animation/
│       ├── procedural-animator.ts
│       └── rig-adapter.ts
├── server/
│   └── services/
│       ├── combat-service.ts
│       ├── damage-service.ts
│       ├── equipment-service.ts
│       └── inventory-service.ts
└── shared/
    ├── combat/
    │   ├── combat-types.ts
    │   ├── hitbox-math.ts
    │   └── network-contract.ts
    ├── weapons/
    │   ├── weapon-types.ts
    │   ├── weapon-definitions.ts
    │   └── motion-definitions.ts
    └── assets/
        └── weapon-asset-contract.ts
```

The current repository is still a Luau starter. The project-wide TypeScript guide
must be followed when implementation begins; compiler output belongs in `out` and
must not be edited by hand.

## 15. Implementation sequence

### Phase 1: asset and equipment

- Clean and organize the Hoplite Sword Studio model.
- Add `WeaponRoot`, `PrimaryGrip`, `HitboxStart`, `HitboxEnd`, and optional `Tip`.
- Add asset validation.
- Create the weapon definition and starter inventory record.
- Equip, unequip, respawn, and re-equip the visual sword without duplicates.

### Phase 2: procedural motion prototype

- Create an R15 rig adapter and joint reset behavior.
- Implement pose interpolation and motion phases.
- Build sword idle, block, Light 1, and recovery poses.
- Verify the animation on local and remote players.
- Add Light 2, Light 3, and heavy charge/strike after the foundation feels stable.

### Phase 3: authoritative combat

- Add the server combat state machine and validated action protocol.
- Implement combo timing and charged-attack timing.
- Implement swept blade queries and per-swing hit deduplication.
- Route damage and blocking through the damage service.
- Add death, respawn, and action cancellation.

### Phase 4: mobile experience

- Build responsive Attack and Block buttons with safe-area handling.
- Add hold progress, combo queue, blocked-hit, and cooldown feedback.
- Test touch cancellation, multi-touch, low frame rates, and common aspect ratios.
- Tune motion and combat timings on an actual phone, not only Studio emulation.

### Phase 5: hardening and polish

- Test with at least two players under simulated latency.
- Verify remote rate limits and invalid-state rejection.
- Add sword trails, impact effects, restrained camera response, and sound hooks.
- Profile several simultaneous combatants on a mobile performance target.
- Confirm repeated respawns do not leak connections or duplicate weapons/UI.

## 16. Definition of done

The first weapon slice is complete when:

- A new player receives `hoplite_sword` and respawns holding it correctly.
- The sword is not a Tool and never appears in the Backpack.
- Moving `PrimaryGrip` in Studio is sufficient to correct the weapon's hand placement.
- Tap Attack performs one light strike; correctly timed repeated taps perform all
  four combo strikes.
- Holding and releasing Attack performs a bounded charged heavy attack.
- Holding Block enters and visibly maintains a defensive state.
- Server-validated sword sweeps damage an enemy at most once per strike.
- Frontal blocking reduces valid damage; attacks from behind are not blocked.
- The system remains usable on touch without relying on hover, right-click, or small
  targets.
- Other clients see synchronized procedural combat motion.
- Invalid or spammed client requests cannot create extra damage or impossible states.
- Death and respawn cleanly reset weapon visuals, controls, animation, and combat state.
- No uploaded character animation asset is required for the complete starter moveset.

## 17. Immediate asset preparation checklist

Before implementation, the only manual Studio work required for the first sword is:

1. Choose or create the clean sword model.
2. Remove every script and unrelated Toolbox object.
3. Name the model `HopliteSword`.
4. Create and assign `WeaponRoot` as its `PrimaryPart`.
5. Add `PrimaryGrip` where the right palm should hold the handle.
6. Add `HitboxStart` at the bottom of the blade.
7. Add `HitboxEnd` near the blade tip.
8. Place it at `ReplicatedStorage/Assets/Weapons/HopliteSword`.

Everything after those semantic markers—equipping, alignment, procedural poses,
input, validation, hit detection, damage, and replication—belongs to the codebase.

## 18. Implemented first slice and lessons learned

Procedural motion development now uses the development-only workflow documented in
[`docs/animation-lab.md`](animation-lab.md). Future animation changes should be
inspected there with deterministic poses and trajectory diagnostics before ordinary
combat playtesting.

The following behavior has been confirmed in Roblox Studio:

- The server clones `ReplicatedStorage/Assets/Weapons/HopliteSword` when an R15
  character spawns.
- `PrimaryGrip` is aligned with the hand's `RightGripAttachment` using the custom
  `WeaponGrip` Motor6D.
- The sword appears in the correct hand and follows the character.
- Left mouse begins a locally predicted procedural light swing.
- Gamepad right trigger uses the same abstract attack action.
- `ContextActionService` creates a dedicated mobile **Attack** button. Generic touch
  input is deliberately not bound, so ordinary screen and UI taps do not attack.
- The server validates the request, equipped weapon, living Humanoid, and cooldown,
  then broadcasts the accepted action for other clients to render.
- The light swing has anticipation, diagonal strike, follow-through, and recovery
  phases and returns the affected joints to neutral.

The light attack is now a server-sequenced four-hit combination:

1. A high-right windup followed by a downward right-to-left diagonal slash.
2. A low-left recovery followed by an upward left-to-right diagonal slash.
3. A forward stab with a procedural visual step and weight shift.
4. A 360-degree spinning slash assembled from several sub-180-degree yaw keyframes,
   preventing `CFrame` interpolation from taking the short path backward.

Every move poses the root, waist, neck, both shoulders and elbows, hips, and knees
when those joints exist. Only the right shoulder is mandatory; missing secondary
joints degrade gracefully for avatar compatibility. Poses run in `PreSimulation` so
they layer after Roblox's Animator evaluation, and all transforms reset after the
move. The client predicts immediately for responsive input while the server owns the
combo step and broadcasts the accepted result. Combo state resets after 1.1 seconds,
on character respawn, and stale unacknowledged client predictions expire.

The optimized pose rig also drives both wrists and ankles. Wrist control is required
to place the blade in the thrust and spinning-cut planes instead of merely moving a
vertical sword with the shoulder. Every attack defines a smaller active strike window
inside its full anticipation/recovery duration; trajectory diagnostics and future hit
detection should evaluate that window rather than treating recovery as damage motion.

The current slice still does **not** deal damage and does not yet implement charged
heavy attacks or blocking. Those remain the next combat milestones.

### Avatar Joint Upgrade compatibility

Future agents must not assume R15 body joints are Motor6Ds. The initial procedural
animation failed silently because the runtime avatar used `AnimationConstraint` for
`RightShoulder`; the only Motor6D found was the custom sword `WeaponGrip`. The fix was
to discover avatar joints semantically, accept `AnimationConstraint`, and apply poses
during `PreSimulation`.

Roblox reference:
[AnimationConstraint](https://create.roblox.com/docs/reference/engine/classes/AnimationConstraint).

### Synchronization checklist

This is a TypeScript-first Rojo project. Studio will not receive source changes unless
both compiler and sync processes are active:

```bash
# Terminal 1
npm run watch

# Terminal 2
rojo serve default.project.json --port 34872
```

Connect the Studio Rojo plugin to `localhost:34872`, stop the current play session,
allow Rojo to synchronize, and then start Play again. If new log statements do not
appear at all, check synchronization before debugging gameplay logic.

### Useful diagnostic prefixes

- `[WeaponServer]`: server runtime, equip, request validation, and broadcast.
- `[WeaponClient]`: client startup, input binding, prediction, and server response.
- `[WeaponAnimator]`: joint discovery and procedural pose playback.

Use Studio's **Output** panel with **All Messages** and **All Contexts** selected. The
debug logging is intentionally verbose while this first combat slice is under active
development and can be reduced after the remaining actions stabilize.
