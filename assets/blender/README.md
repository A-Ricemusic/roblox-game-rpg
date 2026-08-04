# Greek Environment Art Kit

This directory contains the authored first-pass environment kit for the Greek
starting area. The Blender source is deterministic and may be regenerated with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/blender/generate_greek_environment_kit.py
```

The generator writes the editable `.blend` file to `source/` and one Roblox
importable FBX per reusable asset to `exports/`. Render the contact sheet with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  assets/blender/source/greek_environment_kit.blend \
  --python scripts/blender/render_greek_environment_kit.py
```

## Roblox upload

Create an Open Cloud API key with Assets Read and Write access for the game's
creator. Keep it only in the ignored `.env.local` file:

```dotenv
ROBLOX_OPEN_CLOUD_API_KEY=your-secret-key
ROBLOX_CREATOR_ID=3407487520
ROBLOX_CREATOR_TYPE=userId
```

Then run `npm run world:assets:upload`. The uploader never prints the key and
records the resulting asset IDs and content hashes in
`roblox-asset-manifest.json`. Unchanged files reuse the recorded IDs. Uploaded
models become packages owned by the configured creator; creation is an external
side effect and is not transactionally reversible. Moderation or processing can
temporarily delay Studio insertion.

To upload only explicitly changed or newly added assets, pass their collection
names after `--`, for example:

```sh
npm run world:assets:upload -- Greek_Amphora Greek_Temple_Roof
```

Restrict the local secret file with `chmod 600 .env.local`, or inject the key
ephemerally from a system keychain. Never paste it into chat, Studio attributes,
source files, or command-line arguments.

The current geometry and collision remain authoritative until every mesh is
inserted and play-tested. Decorative meshes should be anchored and non-collidable;
the existing invisible or primitive route geometry remains the collision layer.
