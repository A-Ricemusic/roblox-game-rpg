# Player resource UI

The current resource slice is intentionally a presentation foundation, not a combat
or persistence system. It displays three typed pools:

- Health follows the local character's server-replicated `Humanoid.Health` and
  `Humanoid.MaxHealth`.
- Stamina starts at `100 / 100` and remains unchanged unless its typed presentation
  API is called.
- Magic starts at `100 / 100` and follows the same rule.

No NPC damage, stamina consumption, regeneration, spell costs, remotes, saved
profile fields, or Convex data were added. Future stamina and magic gameplay must be
server authoritative; the current client setters are rendering seams and must never
be treated as proof that a gameplay action is affordable.

## Modules

- `src/shared/resources/PlayerResourceTypes.ts` defines immutable values, snapshots,
  defaults, and finite clamping.
- `src/client/resources/PlayerResourceHud.ts` creates the safe-area resource bars.
  Desktop uses the lower-left lane; touch uses a raised bottom-center layout to clear
  the dynamic thumbstick and attack button.
- `PlayerResourceController.ts` owns character/Humanoid lifecycle, restores native
  health UI when stopped, and exposes typed stamina/magic presentation methods.

The controller binds an existing Humanoid immediately, observes health and maximum
health, handles a Humanoid arriving after `CharacterAdded`, disconnects old rigs on
respawn, and guards delayed callbacks with a character generation. It disables only
Roblox's native health CoreGui while the custom HUD is active; Chat, PlayerList,
Backpack, and overhead Humanoid display are untouched.

## Extension rules

- Damage/healing, stamina use/regen, and magic costs belong to authoritative server
  services. Replicate sanitized resource state to this controller rather than
  decrementing pools from input callbacks.
- Define death, exhaustion, casting failure, regeneration delays, and anti-spam rules
  before adding resource gameplay.
- Keep transient pools out of Convex unless reconnect persistence is deliberately
  required and documented.
- Do not let NPC code edit the HUD. NPC/combat systems change authoritative state;
  the HUD observes its projection.

## Quality gates

Resource normalization, Instances, Humanoids, signals, respawn behavior, and GUI
layout are Roblox runtime behavior and belong in Roblox Jest. Run `npm run build`,
`npm run test:build`, `npm test` with an available runtime backend, and
`npm run build:place` after changes.
