# Animation Lab

Status: development-only lab integrated into the current Rojo place

## Purpose

The Animation Lab makes procedural combat motion observable and measurable without
building a separate place or changing the published world. It starts automatically
only when `RunService:IsStudio()` is true. Set the Workspace attribute
`AnimationLabDisabled` to `true` when ordinary Studio playtesting is required.

The lab uses the real local R15 character, equipped Hoplite Sword, avatar joint
adapter, and `SwordMotion` definitions. It does not maintain a separate preview-only
animation implementation.

## Autonomous review loop

After Play begins, the lab:

1. Waits for the real starter sword and its `Tip` attachment.
2. Anchors the character and selects a standardized three-quarter camera.
3. Plays attacks 1–4 at 0.45x speed.
4. Draws the sword-tip path as a persistent gold trail.
5. Captures the 55% contact frame through `CaptureService` without opening a save
   prompt and displays the latest capture in the upper-left review card.
6. Measures the trajectory and prints a report under the `[AnimationLab]` prefix.
7. Holds the ending pose briefly and advances to the next attack.

Roblox intentionally requires explicit user permission before a capture can be saved
to the gallery. The lab therefore uses the no-prompt capture callback for its internal
review card and does not attempt to bypass the platform permission model.

## Controls

The bottom panel provides:

- individual Attack 1–4 selection;
- automatic cycling, play/pause, restart, and next attack;
- deterministic 0%, 25%, 50%, 75%, and 100% pose inspection;
- front, side, rear, and three-quarter cameras;
- elapsed time, normalized progress, trajectory results, and torso clearance.

Any manual selection disables automatic cycling until **Auto** is selected again.

## Structural diagnostics

`MotionDiagnostics` evaluates sword-tip samples in character-local space. Current
checks include:

- minimum sample count;
- minimum torso clearance;
- horizontal and vertical travel for diagonal attacks;
- forward extension and lateral wandering for the thrust;
- minimum cutting radius for the spin.

These checks reject physically wrong motion, but they are not substitutes for visual
direction. A motion can pass its measurements and still require artistic improvement.

### Initial visual baseline

The first autonomous multi-frame review confirmed the original artistic report:

- Attack 1 traces a broad loop rather than a decisive high-right to low-left cut.
- Attack 2 also produces a looping path instead of a clean rising diagonal.
- Attack 3 moves forward but wanders excessively sideways; the diagnostic rejects it.
- Attack 4 turns the character, but the sword radius and arm extension are inconsistent.

This also demonstrates an intentional limitation of the first thresholds: attacks 1,
2, and 4 can pass broad travel checks while still being visually wrong. Their next
iteration should add directional phase checks and target-driven hand/tip paths before
the poses themselves are replaced.

## Code map

- `src/client/animation-lab/AnimationLabController.ts`: lifecycle, UI, camera,
  playback, capture, and reports.
- `src/client/animation-lab/TrajectoryVisualizer.ts`: world-space sword-tip trail.
- `src/shared/animation-lab/MotionDiagnostics.ts`: deterministic measurements.
- `src/client/weapons/ProceduralSwordAnimator.ts`: production animator plus exact-time
  preview and cleanup APIs.
- `src/shared/weapons/SwordMotion.ts`: the single source of truth for combat poses.

## Testing and synchronization

Runtime behavior tests remain Roblox Jest tests as described in `docs/testing.md`.
After source changes:

```bash
npm run build
npm run test:build
npm test
```

Rojo and the TypeScript compiler must both be active for an already-open Studio place
to receive changes. A running Play session must be restarted because its existing
LocalScripts do not restart when their source is replaced.

## Autonomous macOS capture

After granting Screen Recording and Accessibility access to the terminal/Codex host,
an agent can capture an entire review pass without opening another Studio process:

```bash
npm run animation-lab:capture
```

The command verifies that Roblox Studio already exists, focuses that process, restarts
its current test session through Studio's **Test** menu, waits briefly for initialization, and
captures 48 downscaled frames at four frames per second. Frames are written beneath
`artifacts/animation-lab/<timestamp>/` for visual review. It never launches Studio.

Optional environment variables customize the run:

- `ANIMATION_LAB_CAPTURE_DIR`
- `ANIMATION_LAB_FRAME_COUNT`
- `ANIMATION_LAB_FRAME_INTERVAL`

The command resolves the existing Studio place's native window ID and captures only
that window. Studio may remain behind another application during the review, and
unrelated windows cannot appear in the saved evidence. Raw frames are temporary and
should be deleted after review. This is the only part of the workflow outside Roblox;
structural reports and contact-frame thumbnails are still generated inside the lab.
