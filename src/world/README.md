# Greek world source

`world.project.json` is the Rojo entry point for source-controlled world geometry.
The first zone is generated from `scripts/generate-greek-starting-area.mjs`:

```bash
npm run world:generate
npm run world:check
```

The generated `starting-area.project.json` is committed so `rojo serve` does not
require a generation step. Regenerate it after changing the layout script, then
build the production place to validate all Roblox properties.

Rojo owns everything below `Workspace.GreekWorld`. Keep temporary Studio experiments
outside that model. The existing `Workspace.BetaInventoryPickups` folder remains
separate because its stable IDs are persistent gameplay contracts.

Blender source belongs in `assets/blender/source` and exports in
`assets/blender/exports`. Roblox cannot reference an FBX directly: import and upload
it in Studio, then record its mesh and texture asset IDs before adding a `MeshPart`.
