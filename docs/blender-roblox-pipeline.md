# Blender to Roblox Studio Asset Pipeline

This project authors reusable environment assets in Blender, uploads them through
Roblox Open Cloud, validates them in a Studio staging folder, and then references
the resulting MeshPart IDs from the Rojo-managed world source.

## Source of truth

- Authoritative Blender generator: `scripts/blender/generate_greek_environment_kit.py`
- Generated Blender file: `assets/blender/source/greek_environment_kit.blend`
- Roblox-ready exports: `assets/blender/exports/*.fbx`
- Visual contact sheet: `assets/blender/previews/greek_environment_kit.png`
- Upload command: `scripts/upload-greek-assets.mjs`
- Uploaded package manifest: `assets/blender/roblox-asset-manifest.json`
- World generator: `scripts/generate-greek-starting-area.mjs`

The Python generator is the source of truth: it rebuilds the scene and overwrites
the `.blend` file. Make durable asset changes in the generator unless this
workflow is deliberately redesigned. The generated `.blend` file and FBX exports
are committed for inspection and handoff. Credentials are never committed.
The Rojo world source remains authoritative for placement and gameplay behavior;
objects inserted directly into Studio are staging copies until their MeshPart IDs
and placement are represented in source.

## Mandatory Blender visual-quality gate

Blender is the required environment for visual review and approval of every
animation and authored 3D asset. Roblox Studio is used only for importing the
approved export and confirming technical compatibility. Do not use Studio as the
first or primary place to discover malformed motion, self-intersections, poor
silhouettes, bad timing, weak posing, incorrect pivots, broken proportions, or
low-quality modeling.

Before any animation is uploaded or imported, agents must:

- render the complete motion in Blender, not only a single contact pose;
- compare it against every supplied reference image or video;
- inspect the motion from front, side, and three-quarter views;
- inspect anticipation, contact, follow-through, recovery, foot planting, balance,
  hand placement, weapon orientation, and the complete weapon-tip path;
- verify that the weapon never intersects, impales, or passes through its wielder;
- review the full combo at the exact intended gameplay cadence; and
- iterate in Blender until the motion is visually convincing and production-ready.

For static assets, agents must likewise render and inspect the final asset in
Blender from multiple useful angles at representative lighting and scale. Check
silhouette, proportions, materials, texture quality, normals, pivots, and visible
intersections before upload.

Contact sheets and review videos must be written beneath `artifacts/` and actually
inspected before approval. Merely confirming that an FBX exports, uploads, or
returns an `AnimationTrack` is not visual validation. A technically valid asset can
still be unusable. If the Blender review is not satisfactory, do not publish it.

After this gate passes, Studio validation is deliberately narrow: confirm that the
approved file imports, maps to the expected Roblox rig or asset type, retains its
orientation and scale, and can be loaded. Do not redesign or judge the original
artistic quality in the shared Studio instance; other developers may be using it.

## End-to-end flow

```text
Blender Python generator
        ↓
Editable .blend + individual FBX exports
        ↓
Mandatory Blender multi-angle quality review
        ↓
Roblox Open Cloud Assets API
        ↓
Roblox Model package ID + numeric child MeshPart.MeshId values
        ↓
Studio MCP staging insertion
        ↓
Scale, pivot, material, normal and collision checks
        ↓
MeshPart IDs added to the Rojo world generator
        ↓
Rojo sync + play-test
```

## 1. Generate the Blender kit

Run Blender headlessly so results are reproducible:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/blender/generate_greek_environment_kit.py
```

Each asset is authored in its own collection. Use Roblox-scale dimensions and a
shared origin at the bottom center of the asset. Consolidate objects by material
so a reusable prop normally imports as only two or three MeshParts. Apply
modifiers before export and keep geometry comfortably below Roblox's limits.

Render the review image after changing the kit:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  assets/blender/source/greek_environment_kit.blend \
  --python scripts/blender/render_greek_environment_kit.py
```

Review silhouettes, materials, dimensions, pivots, normals, triangle counts, and
FBX file sizes before uploading.

## 2. Configure upload credentials

Create a Roblox Open Cloud key with Assets Read and Write permission. Store it in
the ignored `.env.local` file:

```dotenv
ROBLOX_OPEN_CLOUD_API_KEY=secret-key
ROBLOX_CREATOR_ID=3407487520
ROBLOX_CREATOR_TYPE=userId
```

Use `groupId` when the intended owner is a group. Never place the key in source,
Studio attributes, Roblox Local Secrets, logs, screenshots, or chat. Restrict the
file with `chmod 600 .env.local`. An optional Open Cloud IP restriction should use
the uploader machine's public IP in `/32` CIDR form.

## 3. Upload assets

```sh
npm run world:assets:upload
```

The uploader:

- uploads each FBX as a Roblox Model package;
- polls the Open Cloud operation until it completes;
- rejects redirects and untrusted operation paths before sending credentials;
- validates ownership and the 20 MB upload limit;
- records package IDs and SHA-256 hashes in the asset manifest;
- reuses unchanged manifest entries instead of creating duplicate assets; and
- atomically checkpoints each successful upload.

Upload is an external side effect. Roblox moderation or processing may delay
insertion. If an FBX changes, its content hash changes and a new package is
created; update source references only after validating that package.

## 4. Insert into Studio staging

First list connected Studio instances and explicitly confirm or select the active
`greek rpg game` instance. Confirm it is in Edit mode. Create or reuse exactly one
Folder named `ServerStorage.GreekAssetStaging` with a safe edit-time Luau command.
Then use Studio MCP's `insert_asset` operation with `assetType: Model`, the
manifest's package ID, and `parentPath: ServerStorage.GreekAssetStaging`. Insert one
copy of every changed asset before editing the live world.

Never stage an unvalidated import in Workspace. ServerStorage prevents an
oversized or misplaced package from rendering, colliding with players, changing
camera behavior, or disrupting another developer's play-test. After validation,
promote only one approved asset at a time into a dedicated Workspace preview
location, with all descendant BaseParts anchored and collision, touch, and query
disabled. Remove that preview before validating the next asset.

For every inserted package, inspect:

- Model pivot and bounding box;
- expected world dimensions and axis orientation;
- child MeshPart IDs and relative transforms;
- inverted normals or missing faces;
- imported materials and colors; and
- anchoring, collision, touch, and query properties.

### Mandatory scale and placement gate

An imported asset must match the scale of the existing Roblox scene before it is
placed or replicated. Do not assume that Blender units, the package preview, or
an FBX's stored transform survived import correctly. Measure the inserted Model
with `GetBoundingBox()` and compare it numerically with the specific blockout part
or neighboring asset it replaces. For example, a temple roof intended for the
current 42 × 34 stud temple floor should be approximately 45 × 38 studs—not
hundreds of studs across.

Also inspect the Model pivot, each child `MeshPart.Size`, and each child CFrame
relative to the Model pivot. Insert and validate exactly one staging copy before
cloning or referencing it throughout the world. If any dimension, position, or
pivot is unexpected, stop and correct the Blender export or source transform;
never compensate by eyeballing a large mesh in the live map.

Before promotion, enforce a conservative hard bound appropriate to the target.
Reject an asset if any dimension exceeds both its documented replacement size and
the expected overhang tolerance. For example, a temple roof may be approximately
45 × 38 studs for a 42 × 34 stud temple, but it must be rejected if it imports at
450 × 380. Validation must compare numbers, not visual appearance or camera
framing.

When MeshParts are created through Rojo, use an explicit `CFrame` for placement.
Assigning only `Position`/`Orientation` can be lost when Roblox applies `MeshId`,
causing imported geometry to stack at the world origin. After every sync, query
the live MeshPart and assert its actual `Size`, `Position`, and bounding box
against the intended blockout dimensions before taking screenshots or entering
Play mode.

FBX material colors can arrive in Roblox as gray Plastic. Treat Blender materials
as authoring and preview metadata unless a tested SurfaceAppearance/PBR pipeline
exists. Set Roblox `Color`, `Material`, and transparency explicitly in the Rojo
world generator.

Staging MeshParts should be anchored with `CanCollide`, `CanTouch`, and `CanQuery`
disabled. Do not broadly replace the world until the staging copy passes visual
inspection.

## 5. Integrate with the Rojo world

The upload manifest stores Model package IDs used by `insert_asset`; those are not
the IDs consumed by the world generator. From each inserted child, record the
numeric asset portion of its `MeshPart.MeshId` property—not the Instance
`UniqueId`—along with its `Size` and CFrame relative to the Model pivot. Add those
MeshId values and transforms to `scripts/generate-greek-starting-area.mjs`, then
regenerate the checked-in world:

```sh
npm run world:generate
npm run world:check
```

Decorative meshes must not become the authoritative gameplay collision. Preserve
the existing primitive floors, stairs, ramps, walls, route boundaries, and other
simple collision geometry. When a mesh visually replaces a primitive prop, make
the legacy primitive transparent but retain it when it provides intentional
collision.

Preserve server-owned gameplay instances, including CollectionService tags,
stable pickup IDs, attributes, ProximityPrompts, Fire, PointLight, and other
runtime children. Pickup meshes should be decorative children of the existing
tagged pickup roots rather than replacements for those roots.

Direct Studio edits are not durable. The integration is complete only when a
fresh Rojo build reproduces the redesigned environment.

The default Rojo project intentionally does not mount `GreekWorld` while the art
pass is under isolated review. Do not restore that mapping until every referenced
mesh has passed ServerStorage bounds validation and a one-at-a-time Workspace
preview. Re-enabling the mapping is a separate reviewed change.

## 6. Verify and commit

At minimum run:

```sh
npm run world:check
npm run build
npm run format:check
npm test
```

Play-test the synced place in Roblox Studio and capture representative views of
the starting area. Verify player routes, stairs, prompts, pickups, lights, camera
readability, and performance. If the Roblox Jest backend is unavailable, report
that limitation instead of claiming the runtime suite passed.

Commit the Blender sources, exports, non-secret asset manifest, generator changes,
and documentation together. Never stage `.env.local` or unrelated changes from
other agents.
