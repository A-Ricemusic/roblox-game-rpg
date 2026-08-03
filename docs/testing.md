# Roblox TypeScript testing architecture

This project runs behavior tests in Roblox itself. Do not replace these tests with Vitest, Node Jest, or a browser-only test runner: those environments cannot faithfully reproduce Roblox Instances, events, services, CollectionService tags, DataStore behavior, Luau semantics, or the client/server boundary.

The test stack is:

- `rbxtsc` in strict mode for compile-time checks.
- [`@rbxts/jest`](https://github.com/littensy/rbxts-jest) for TypeScript test files that compile to Luau and execute in Roblox.
- [`@isentinel/jest-roblox`](https://github.com/christopher-buss/jest-roblox-cli) for terminal execution, TypeScript source mapping, Open Cloud/Studio backends, and coverage.
- [`@isentinel/roblox-ts`](https://github.com/christopher-buss/roblox-ts) because the terminal runner currently requires this compiler fork for source maps and coverage instrumentation.
- [Lute](https://github.com/luau-lang/lute) for Luau AST coverage instrumentation.
- Rojo for deterministic clean and staging test places.
- `convex-test` with Vitest for the Convex-only schema, transaction, lease,
  idempotency, and HTTP Action layer. This exception does not move Roblox runtime
  behavior out of Roblox; Convex functions execute in a separate TypeScript runtime.

Versions are pinned in `package.json`, `package-lock.json`, and `rokit.toml`. Do not upgrade the compiler independently of `@rbxts/compiler-types`; macro compatibility must be verified as a pair.

## Commands

```bash
npm ci                    # exact Node dependencies
rokit install             # pinned Rojo and Lute binaries
npm run build             # strict rbxtsc compile
npm run test:build        # compile and build test.rbxl
npm test                  # Roblox runtime tests without coverage
npm run test:coverage     # runtime tests plus enforced coverage thresholds
npm run test:staging      # opt-in DataStore staging suite
npm run test:convex       # deterministic Convex transaction/API tests
npm run test:convex:coverage # Convex tests with 80% global thresholds
npm run format:check      # formatting gate
```

`npm run build` and `npm run test:build` do not require Roblox Studio. Runtime test commands require one of the backends below.

## Local backend setup

The default backend is `auto`. It uses an attached Studio plugin when one is connected; otherwise it uses Open Cloud only when all three credentials are available. With neither configured, it intentionally exits instead of pretending tests ran.

Install the Jest Roblox Studio plugin from the [latest `jest-roblox-cli` release](https://github.com/christopher-buss/jest-roblox-cli/releases), then place `JestRobloxRunner.rbxm` in the Roblox Studio plugins folder. The runner also documents a Drillbit installation option. Keep the plugin version compatible with the CLI version in `package.json`.

For an already-open Studio session with the plugin active:

```bash
npm test
```

For a self-launched local Studio session:

```bash
npm run test:build
npx jest-roblox --config jest.config.mjs --backend studio-cli --no-coverage
```

On macOS, set the executable explicitly if automatic discovery fails:

```bash
export JEST_ROBLOX_STUDIO_PATH=/Applications/RobloxStudio.app/Contents/MacOS/RobloxStudio
```

Coverage requires `lute` on `PATH`. `rokit install` provides the pinned binary; ensure the Rokit bin directory is on `PATH`.

## Open Cloud and CI

CI uses a dedicated, non-production Roblox experience and these repository secrets:

- `ROBLOX_OPEN_CLOUD_API_KEY`
- `ROBLOX_UNIVERSE_ID`
- `ROBLOX_PLACE_ID`

The API key must have only the permissions needed to upload and execute the dedicated test place. Never point the workflow at a production universe. `.github/workflows/ci.yml` fails when credentials are missing and runs `npm run test:coverage`; thresholds in `jest.config.mjs` therefore act as a merge gate.

Current global thresholds are 80% branches and 85% functions, lines, and statements. Adapters that require real external services are excluded from unit coverage only when they have an isolated staging suite.

## Test-place separation

- `test.project.json` builds `test.rbxl` for deterministic unit and Roblox service integration tests. Production client/server entry points are excluded, so tests do not start DataStores, autosave loops, or player lifecycle wiring.
- `test.staging.project.json` builds `test-staging.rbxl` and sets `RunQuestDataStoreStagingTests`. Only `*.staging.spec.ts` files run under `jest.staging.config.mjs`.
- Staging persistence uses `PlayerQuestProfiles_Staging_v1`, generates a unique key for each run, and removes that key afterward. It must never use the production store name.

DataStore staging tests consume real service budget and require a published staging experience with API-service access. Run them deliberately, not on every save or against production data.

## Quest coverage map

The current suites cover:

- definition validation, duplicate IDs, and invalid requirements;
- item/source matching and unrelated events;
- duplicate collectible protection, progress caps, stage advancement, and quest completion;
- multiple simultaneous quests and isolated player profiles;
- profile serialization, schema migration, and malformed persisted data;
- retryable/non-retryable persistence failures and capped exponential retry behavior;
- real CollectionService tag registration and removal;
- collectible attribute validation, stable ID collisions, and interaction distance;
- server-derived item IDs/quantities and rejection of unregistered or distant claims;
- read-only remote requests, malformed messages, spoofed progress requests, and request rate limiting;
- quest view-model snapshots, HUD empty/progress rendering, and malformed client payload handling;
- isolated staging DataStore save/load/remove behavior.
- Convex leases, expired-session takeover, optimistic revisions, idempotent writes,
  atomic save-and-release, legacy migration state, HTTP authentication, and malformed
  API requests.

## Design rules for new tests

1. Put deterministic logic behind an injected interface. Use a fake repository, clock, sleeper, or remote in the unit suite.
2. Test Roblox behavior in Roblox. It is appropriate to create Instances, tags, attributes, BindableEvents, and GUI objects inside `*.spec.ts` tests.
3. Keep client requests intent-only. A client test may request a snapshot or interact with a Roblox prompt; it must never author quest progress, an item ID, a quantity, or a completion result.
4. Add a regression test with every bug fix. Exercise the public boundary that failed, not private implementation details.
5. Clean up every Instance, tag, connection, and staging key created by a test.
6. Do not weaken coverage thresholds to land untested behavior. Add coverage or explicitly isolate an external-service adapter with a staging test and a documented exclusion.

Useful primary references: the [`@rbxts/jest` repository](https://github.com/littensy/rbxts-jest), the [`jest-roblox-cli` documentation](https://github.com/christopher-buss/jest-roblox-cli), the [Lute repository](https://github.com/luau-lang/lute), and the [Rojo project format](https://rojo.space/docs/v7/project-format/).
