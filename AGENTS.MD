We prefer using roblox-ts instead of standard roblox lua. If you have any questions review the documentation:
https://roblox-ts.com/docs/quick-start
github repo: https://github.com/roblox-ts/roblox-ts

Please use roblox jest to run unit and integration tests to make sure everything is working correctly after changes

We are using Rojo to sync code between this directory and roblox studio. make sure code is correcly placed in the correct folder structure.

Please use correct types and DO NOT use type any unless it is specifically necessary.

Before changing quests, read `docs/quest-system-implementation.md` and `docs/quest-system-design.md`. Before adding or changing tests, read `docs/testing.md` and keep runtime behavior tests inside Roblox.

Before changing player persistence, profiles, or database configuration, read `docs/player-database.md`. Roblox clients must never call Convex or receive database credentials.

Before changing inventory, items, or world pickups, read `docs/inventory-system.md`. Inventory must remain independent of weapon and combat behavior until an explicit integration is designed.

Before creating, uploading, importing, or replacing Blender/Roblox assets, read `docs/blender-roblox-pipeline.md`. Keep credentials local, validate packages in `ServerStorage.GreekAssetStaging`, and never mount or promote imported world geometry until numeric bounds and placement checks pass.
