# Realistic Sicilian pirates

`blender/RealisticSicilianPirates.blend` contains the skinned source for the melee Sicilian Corsair and ranged Sicilian Marksman. The Blender file packs the 512px game textures used by the Roblox uploads. The FBXs and their uploaded asset IDs are under `exports/realistic-pirates/`.

The human topology, skin, hair, clothing, and footwear are generated with [MPFB](https://github.com/makehumancommunity/mpfb2) and [MakeHuman assets](https://github.com/makehumancommunity/makehuman-assets). Generated MakeHuman assets are CC0; MPFB generator code is GPL-3.0 and is not vendored into this repository.

To rebuild, install the MPFB Blender extension and provide a MakeHuman assets checkout:

```bash
MAKEHUMAN_ASSETS=/path/to/makehuman-assets \
  /Applications/Blender.app/Contents/MacOS/Blender \
  --background --python animation/build_realistic_sicilian_pirates.py
```

Upload corrected FBXs with `npm run pirates:models:upload`. Upload the shared custom-skeleton animation sequences with `npm run bandit:animations:upload`.
