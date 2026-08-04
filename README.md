# RobloxGame

A production Roblox project written in strict TypeScript with roblox-ts and synchronized with Rojo.

## Getting Started

Install the pinned dependencies and build the place with:

```bash
npm ci
rokit install
npm run build:place
```

For live development, compile continuously in one terminal:

```bash
npm run watch
```

Then start the Rojo server in another terminal and connect the Studio plugin:

```bash
rojo serve
```

For more help, check out [the Rojo documentation](https://rojo.space/docs).

## Tests

```bash
npm run build
npm test
npm run test:coverage
```

Runtime tests execute inside Roblox. See the [testing architecture and local setup](docs/testing.md) before the first runtime test.

## Design documents

- [RPG combat system plan](docs/combat-system-plan.html)
- [Weapon system design](docs/weapon-system-design.md)
- [Quest system design](docs/quest-system-design.md)
- [Roblox TypeScript (`roblox-ts`) guide](docs/roblox-typescript.md)
- [Testing architecture](docs/testing.md)
