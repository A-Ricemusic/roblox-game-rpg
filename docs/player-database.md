# Convex player database

## Current production deployment

Aggregate player profiles are stored in the Convex project `anthonyricemath/robloxgame`.
The production deployment is `grand-basilisk-273`:

- Function URL: `https://grand-basilisk-273.convex.cloud`
- Roblox HTTP Actions URL: `https://grand-basilisk-273.convex.site`
- Health check: `https://grand-basilisk-273.convex.site/v1/health`

When Convex is selected in Studio, it uses the isolated cloud development deployment
`prestigious-crab-721` by default (`https://prestigious-crab-721.convex.site`). Live
servers use production. These defaults live in the server configuration module
rather than DataModel root attributes so Rojo cannot clear them while a play session
starts.

The repository contains the aggregate quest/inventory schema and HTTP actions. Deploy
additive Convex schema changes before enabling the corresponding Roblox build against
an environment. For weapon inventory, `inventoryProfile.equipment` remains optional
at the Convex boundary so legacy documents and older live servers remain compatible.
The server configuration carries the non-secret environment URLs and secret-name
default. Never put the shared secret, a Convex deploy key, or a Convex admin key in
source control or a Roblox client.

## One required Roblox configuration step

Roblox cannot receive Secret Store values through Rojo. Before a published place
can load player data:

1. Enable **Allow HTTP Requests** in the experience's Game Settings > Security.
2. Read the generated production value with
   `npx convex env get --prod ROBLOX_PLAYER_DATABASE_SECRET` in a private terminal.
3. Add that exact value to the experience's Roblox Secret Store under
   `CONVEX_PLAYER_DATABASE_KEY`.
4. Do not paste the value into a game attribute, source file, issue, log, or chat.

For Studio testing against a remote deployment, add the same key through Studio's
local secrets facility. The default unpublished-place behavior intentionally uses
an in-memory repository, so ordinary local play remains fast and offline. See the
[Roblox Secrets Store documentation](https://create.roblox.com/docs/cloud-services/secrets)
for current Creator Hub and Studio instructions.

When rotating the credential, generate at least 32 random bytes, update the Convex
environment variable and Roblox Secret Store value together, then invalidate the
old value. The deployed HTTP API fails closed if its environment variable is absent
or shorter than 32 characters.

## Runtime architecture

```text
Roblox client
    │ display-only domain snapshots / interaction intent
    ▼
Roblox game server (authoritative)
    │ HTTPS + Secret Store Authorization header
    ▼
Convex HTTP Action (.convex.site)
    │ validated internal transactional mutation
    ▼
playerProfiles table
```

Clients never contact Convex and never supply progress, profile revisions, item
quantities, or database credentials. The Roblox server remains authoritative and
uses `HttpService.RequestAsync`; Convex HTTP actions authenticate the request before
calling internal mutations.

The current `playerProfiles` document contains:

- stable `profileKey` (`player:<Roblox user id>`), indexed uniquely by convention;
- the strictly validated quest profile;
- the strictly validated inventory profile containing quantities, claimed pickup IDs,
  and the selected owned weapon slot;
- a monotonically increasing revision;
- `pending` or `complete` legacy-migration state;
- an optional server session lease;
- the most recent idempotent operation marker;
- creation and update timestamps.

Quest and inventory use separate typed domain services while sharing one aggregate
load/save transaction. Keep future currency, equipment, achievements, and other
persistent domains behind their own typed boundaries. Extend the aggregate schema
deliberately; do not let unrelated systems mutate quest or inventory child objects.

## Concurrency and failure safety

Every load acquires a 180-second lease containing a generated session ID and Roblox
server ID. A different live server receives HTTP 409 instead of loading the same
profile. Autosaves run every 60 seconds and renew the lease. An expired lease may be
taken over after a crashed server stops renewing it.

Dirty saves provide both the expected revision and an operation ID. Convex validates the
session, compares the revision, writes the profile, increments the revision, and
records the operation atomically. Retrying after a lost HTTP response returns the
same revision instead of applying the save twice. The operation marker lives on the
player document, so autosaves do not create an unbounded transaction-log table.
Once a profile is clean, autosave uses a small authenticated lease-renew request
instead of retransmitting the full aggregate. Disconnect still performs one atomic
full save-and-release.

Player removal uses one atomic save-and-release mutation. `BindToClose` does the
same for any profiles still loaded. If a release fails after bounded exponential
retries, the lease expires naturally; another server cannot take over while the old
server may still be writing.

HTTP 429, network failures, server errors, and malformed bodies on otherwise
successful writes are retryable with the same operation ID. Authentication and
invalid requests are terminal. Stale revisions, superseded sessions, and unknown
write conflicts mean ownership is lost: the loaded profile is quarantined against
all further mutation and the player is disconnected. The unsaved in-memory snapshot
is retained until server shutdown for diagnosis but is never logged automatically.
A profile that cannot be loaded safely is never replaced with empty data.

Roblox currently limits outbound external HTTP requests per game server. The
one-minute autosave cadence remains comfortably below that limit for normal Roblox
server sizes, and clean profiles renew only lease metadata. New database-backed
subsystems should share the player profile save rather than creating independent
polling loops. See
[Roblox HttpService](https://create.roblox.com/docs/cloud-services/http-service).

## Legacy Roblox DataStore migration

`MigratePlayerDataStore` defaults to `true` on live servers and `false` in Studio.
The first Convex acquisition creates a document marked `pending`; while pending, the
Roblox adapter reads `PlayerQuestProfiles_v1`. The decoded/migrated profile becomes
authoritative only when a Convex save succeeds, which changes the marker to
`complete`.

This design handles failed legacy reads safely: the marker remains pending and the
next connection retries the import. Once production metrics confirm that every
returning player has migrated, change `MigratePlayerDataStore` to `false`. Retain a
read-only backup/export of the old DataStore for the rollback window. Never run the
migration against the staging DataStore name.

## Configuration attributes

The server reads these DataModel attributes:

- `PlayerDatabaseBackend`: optional `Convex`, `DataStore`, or `Memory`. With no
  value, unpublished places use `Memory` and published places use `Convex`.
- `ConvexSiteUrl`: optional `.convex.site` override. Studio defaults to
  `prestigious-crab-721`; live servers default to `grand-basilisk-273`.
- `ConvexSecretName`: Roblox Secret Store key; defaults to
  `CONVEX_PLAYER_DATABASE_KEY`.
- `MigratePlayerDataStore`: defaults to `false` in Studio and `true` on live
  servers; see the migration procedure above.

`Memory` and `DataStore` are explicit development or recovery tools. `DataStore` is
not a transparent live rollback: it contains an isolated aggregate profile dataset
unless an operator has deliberately imported current Convex data. Production does
not silently fall back when Convex is unavailable because that would fork a player's
data between databases.

## Development, tests, and deployment

```bash
# Start/watch a local Convex deployment
npm run convex:dev

# Regenerate committed Convex TypeScript bindings
npm run convex:codegen

# Transaction and HTTP contract tests
npm run check:convex
npm run test:convex
npm run test:convex:coverage

# Roblox adapter/runtime compile and tests
npm run build
npm test

# Deploy schema, indexes, and functions to production
npm run convex:deploy
```

Convex backend tests use the official `convex-test` transaction simulator with
Vitest because these files execute in Convex's TypeScript runtime, not Roblox.
Roblox adapters and gameplay behavior remain in `@rbxts/jest` and execute in Roblox.
CI enforces at least 80% Convex line, branch, function, and statement coverage in
addition to the existing Roblox coverage thresholds.

Deployments must pass `npx convex dev --once --typecheck enable`, strict `rbxtsc`,
both test suites, formatting, and the Rojo production-place build. After deploying,
verify the health endpoint, verify an unauthenticated profile call returns 401, and
perform an authenticated acquisition in a staging identity before enabling a live
place.

## Operational checks

- Convex dashboard: monitor function failures, mutation latency, database storage,
  and request volume for `grand-basilisk-273`.
- Roblox server logs: alert on `[PlayerRuntime] Failed to load/save` and
  `[PlayerDatabase]` warnings without logging request bodies or secrets.
- Before schema changes: use additive optional fields, backfill, deploy readers,
  then make constraints stricter in a later deploy.
- Backups: schedule Convex exports appropriate to the release cadence and test a
  restore into a non-production project.
- Incident fallback: fix or roll back Convex first. Use the DataStore backend only
  after explicitly verifying or importing current aggregate data; never alternate
  backends automatically.

Primary Convex references: [HTTP Actions](https://docs.convex.dev/functions/http-actions),
[schemas](https://docs.convex.dev/database/schemas),
[authentication](https://docs.convex.dev/auth/overview), and
[limits](https://docs.convex.dev/production/state/limits).
