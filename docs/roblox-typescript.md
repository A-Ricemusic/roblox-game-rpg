# Roblox TypeScript (`roblox-ts`) Guide

This document is the project-wide reference for humans and coding agents working on
this Roblox game. The project direction is **TypeScript-first**: game source should be
written in TypeScript and compiled to Luau with
[`roblox-ts`](https://roblox-ts.com/docs/), rather than authored directly in Luau.

## Project status and agent rules

The roblox-ts migration is complete. TypeScript source lives under `src`, `rbxtsc`
emits Luau into `out`, and the Rojo project files map generated output into Roblox.
`package.json`, `tsconfig.json`, and the lockfile define the pinned toolchain. Every
agent must follow these rules:

1. Treat files under `src/**/*.ts` and `src/**/*.tsx` as the source of truth.
2. Do not hand-edit compiler output under `out`; `rbxtsc` regenerates it.
3. Do not add new Luau when TypeScript can implement the feature. Existing Luau may
   be used temporarily only through an accompanying `.d.ts` declaration.
4. Preserve the `src/server`, `src/client`, and `src/shared` execution boundaries.
   Shared code must be safe to run on both client and server.
5. Keep strict types. Prefer inference or a precise type; use `unknown` plus runtime
   validation for untrusted values. Avoid `any` and unchecked casts.
6. Treat all client-to-server data as untrusted, even if a TypeScript type says what
   the client intended to send.
7. Run the TypeScript build/typecheck before considering a code change complete.

## What `roblox-ts` actually does

Roblox Studio does not execute TypeScript. `roblox-ts` parses TypeScript, checks it,
and emits functionally equivalent Luau. Rojo then builds or synchronizes that Luau
into Studio:

```text
src/**/*.ts
    |  rbxtsc (roblox-ts compiler)
    v
out/**/*.lua
    |  rojo build / rojo serve
    v
Roblox Studio DataModel
```

This gives the project TypeScript's static type system, editor completion,
refactoring support, ESLint, Prettier, and compatible npm packages while still
running Luau in Roblox. The compiler also reads the Rojo project file to understand
where modules will live in the DataModel and to compile imports correctly.

One tradeoff is that Studio errors and the Studio debugger refer to emitted Luau,
not the original TypeScript. Keep functions small and readable so compiled stack
traces are easier to map back to their TypeScript source.

## Toolchain setup

The official prerequisites are Node.js 18 or newer, Rojo 7 or newer, and a code
editor (VS Code is the best-supported option). The official initializer is:

```bash
npm init roblox-ts
```

The initializer is designed for an empty directory. **Do not run it blindly over
this existing repository.** For this project, generate a game template in a temporary
directory first, then deliberately merge its `package.json`, lockfile,
`tsconfig.json`, tool configuration, `include` layout, and Rojo mappings into this
repository. Migrate each source file from `.lua` to `.ts` and verify the output.

A roblox-ts game normally has this shape:

```text
src/
  client/       TypeScript that runs on clients
  server/       TypeScript that runs on the server
  shared/       TypeScript available to both sides
out/            generated Luau; never edit by hand
include/        roblox-ts runtime support
node_modules/   dependencies, including @rbxts packages
tsconfig.json
default.project.json
package.json
```

The important Rojo migration detail is that source mappings must point at paths
relative to the TypeScript compiler's `outDir` (normally `out`), not directly at
`src`. The generated `include` and `node_modules/@rbxts` locations must also be
mapped somewhere both client and server can access, normally ReplicatedStorage.

Do not copy a stale configuration from this guide. Let the current initializer
choose compatible dependency versions and compiler settings, commit the lockfile,
and keep `roblox-ts` and `@rbxts/types` versions compatible.

### Daily development loop

The short official workflow is:

```bash
# Terminal 1: continuously typecheck and compile TypeScript to Luau
npx rbxtsc -w

# Terminal 2: synchronize generated Luau to Roblox Studio
rojo serve
```

If the generated package scripts expose the official watch command, this is
equivalent and preferable for consistency:

```bash
npm run watch
```

Connect the Rojo Studio plugin to the running server. For a one-time compiler build,
run `npx rbxtsc`; use `npx rbxtsc --help` for the current CLI options.

## Types available to the project

### TypeScript language types

Normal TypeScript modeling tools are available and should be used heavily:

- Primitives: `string`, `number`, `boolean`, `undefined`, and `unknown`.
- Object shapes through `interface` and `type` aliases.
- Optional fields (`field?: T`) and immutable fields (`readonly field: T`).
- Literal and union types such as `"Idle" | "Attacking" | "Stunned"`.
- Intersections such as `Model & { Humanoid: Humanoid }`.
- Generic types and constraints such as `<T extends Instance>`.
- Discriminated unions for state machines and network message variants.
- Collections including `Array<T>`, `ReadonlyArray<T>`, `Map<K, V>`, `Set<T>`,
  `ReadonlyMap`, `ReadonlySet`, `WeakMap`, and `WeakSet`.
- `Promise<T>` for typed asynchronous work supported by the bundled promise API.

Example domain model:

```ts
type CombatState =
	| { readonly kind: "Idle" }
	| { readonly kind: "Attacking"; readonly comboIndex: number }
	| { readonly kind: "Stunned"; readonly endsAt: number };

interface DamageRequest {
	readonly targetId: string;
	readonly attack: "Light" | "Heavy";
}

function describeState(state: CombatState): string {
	switch (state.kind) {
		case "Idle":
			return "Ready";
		case "Attacking":
			return `Combo ${state.comboIndex}`;
		case "Stunned":
			return `Stunned until ${state.endsAt}`;
	}
}
```

Prefer unions like this to loose strings, booleans that can contradict each other,
or broad dictionaries.

### Roblox engine types

`@rbxts/types` provides ambient typings generated partly from the Roblox API dump
and partly by hand. Roblox classes and datatypes are global types, so they normally
need no import:

- Class hierarchy: `Instance`, `BasePart`, `Part`, `Model`, `Humanoid`, `Player`,
  `RemoteEvent`, and the rest of the supported Roblox class API.
- Datatypes: `Vector2`, `Vector3`, `CFrame`, `Color3`, `UDim2`, `RaycastParams`, and
  other engine datatypes.
- Enums and enum items such as `Enum.Material.Neon`.
- Typed properties, methods, callbacks, and `RBXScriptSignal` event connections.
- Roblox globals and libraries such as `game`, `workspace`, `print`, `math`, and
  `task`, subject to the roblox-ts declarations.

The Roblox inheritance tree participates in TypeScript checking:

```ts
function totalSize(part: BasePart): number {
	return part.Size.X + part.Size.Y + part.Size.Z;
}

totalSize(new Instance("Part"));     // valid: Part extends BasePart
totalSize(new Instance("WedgePart")); // valid
// totalSize(new Instance("Humanoid")); // compile error
```

Roblox `.new()` constructors use TypeScript's `new` syntax:

```ts
const direction = new Vector3(0, 1, 0); // emits Vector3.new(0, 1, 0)
const part = new Instance("Part");      // inferred as Part
```

Use `undefined` wherever Luau code would use `nil`, both as a type and a value.

### Services and instance-name maps

Install and use `@rbxts/services` when the project needs service singletons:

```ts
import { Players, ReplicatedStorage, RunService, Workspace } from "@rbxts/services";

Players.PlayerAdded.Connect((player) => {
	print(player.Name);
});
```

The global mapping interfaces are especially useful for generic helpers:

- `Services`: service name to service instance type.
- `CreatableInstances`: creatable class name to instance type.
- `AbstractInstances`: abstract class name to instance type.
- `Instances`: every known Roblox instance class; it includes the three mappings
  above plus types that are only returned by APIs.

`keyof` produces valid names and indexed access produces the matching class:

```ts
type ServiceName = keyof Services;
type AnyService = Services[keyof Services];

function descendantsOfClass<K extends keyof Instances>(
	parent: Instance,
	className: K,
): Array<Instances[K]> {
	return parent
		.GetDescendants()
		.filter((child): child is Instances[K] => child.IsA(className));
}
```

### Typing the project's DataModel

The general type `Workspace` cannot know that this particular game contains a model
named `Enemies`. Describe stable, authored children with ambient declarations in a
`.d.ts` file that contains no imports or exports:

```ts
// src/types/services.d.ts
interface Workspace extends Instance {
	Enemies: Folder;
}

interface ReplicatedStorage extends Instance {
	Remotes: Folder & {
		RequestAttack: RemoteEvent;
	};
}
```

Then service access is checked end to end:

```ts
import { ReplicatedStorage, Workspace } from "@rbxts/services";

const enemies = Workspace.Enemies; // Folder
const attackRemote = ReplicatedStorage.Remotes.RequestAttack; // RemoteEvent
```

Only declare children guaranteed to exist at that point in execution. For dynamic or
optional children, use lookup/wait APIs and narrow the returned instance. Keep the
declarations synchronized with the Rojo tree and Studio-authored assets; an incorrect
`.d.ts` file can hide a runtime bug.

### Utility types

Both familiar TypeScript utility types and roblox-ts-specific helpers are available.
Common choices include:

| Need | Type |
| --- | --- |
| Make fields optional or required | `Partial<T>`, `Required<T>` |
| Make fields readonly or writable | `Readonly<T>`, `Writable<T>` |
| Select or remove keys | `Pick<T, K>`, `Omit<T, K>` |
| Build a keyed object | `Record<K, T>` |
| Filter a union | `Exclude<T, U>`, `Extract<T, U>` |
| Remove nil-like cases | `NonNullable<T>` |
| Reuse function signatures | `Parameters<T>`, `ReturnType<T>` |
| Select keys by value type | `ExtractKeys<T, U>`, `ExcludeKeys<T, U>` |
| Select Roblox properties | `InstanceProperties<T>` |
| Select Roblox methods | `InstanceMethods<T>` |
| Select Roblox events | `InstanceEvents<T>` |
| Select settable Roblox properties | `WritableInstanceProperties<T>` |

Example of deriving a checked configuration shape:

```ts
type PartConfiguration = Partial<WritableInstanceProperties<Part>>;

const spawnPadStyle = identity<PartConfiguration>({
	Anchored: true,
	CanCollide: true,
	Color: new Color3(0.2, 0.8, 1),
});
```

Do not use an advanced utility type merely because it exists. Prefer the clearest
domain interface until a utility type removes real duplication.

## Runtime narrowing and network safety

Static types disappear after compilation. They cannot prove that a value received at
runtime—from a client, DataStore, HTTP response, attribute, or legacy Luau module—is
valid. Represent an unchecked value as `unknown`, validate it, and only then use it.

roblox-ts provides narrowing macros:

- `typeIs(value, "number")` and datatype variants such as `"Vector3"` compile to a
  Luau `typeof` check and narrow the value in TypeScript.
- `classIs(instance, "Script")` checks the exact `ClassName` and narrows it.
- `instance.IsA("BasePart")` narrows according to Roblox inheritance.
- `assert(condition)` narrows after a successful assertion.
- `identity<T>(value)` enforces a type constraint with no runtime cost; it is not a
  validator for untrusted input.

Server RemoteEvent payloads intentionally arrive as `unknown` in the roblox-ts
typings. This is a security feature:

```ts
const requestDamage = new Instance("RemoteEvent");

requestDamage.OnServerEvent.Connect((player, rawDamage: unknown) => {
	if (!typeIs(rawDamage, "number")) {
		return;
	}
	if (rawDamage < 0 || rawDamage > 100) {
		return;
	}

	// rawDamage is now a number, but the server must still authorize the action.
	print(player.Name, rawDamage);
});
```

Type checking answers “does this value have the expected shape?” Server validation
must also answer “is this player allowed to do this now?” Prefer a maintained runtime
validator such as `@rbxts/t` when payloads become nested, and keep authoritative game
state on the server.

## Important TypeScript-to-Luau differences

### Datatype math

TypeScript cannot express Roblox operator overloading. For Roblox datatypes, use the
roblox-ts macro methods instead of JavaScript arithmetic operators:

```ts
const start = new Vector3(1, 2, 3);
const offset = new Vector3(0, 5, 0);
const result = start.add(offset).mul(2);
```

The macros `.add()`, `.sub()`, `.mul()`, and `.div()` emit Luau `+`, `-`, `*`, and
`/` for datatypes that support those operations.

### Callbacks versus methods

Luau distinguishes `object.callback()` from `object:method()` even though TypeScript
uses a dot at the call site for both. roblox-ts decides from the declaration:

```ts
const object = {
	callback: (value: number) => print(value), // emits a dot-style callback
	method(value: number) {                    // emits a colon-style method
		print(this, value);
	},
};
```

An explicit `this: void` forces callback semantics. A non-void `this` parameter
forces method semantics. Be exact when declaring types for existing Luau APIs because
the wrong form changes whether `self` is passed.

### Multiple returns and `LuaTuple<T>`

A TypeScript tuple such as `[string, number]` is an array value. A Luau function that
returns two values is different and is represented by `LuaTuple<[string, number]>`.
Roblox API declarations already use this where needed:

```ts
const [elapsed, total] = wait(1);
```

Destructuring preserves the multiple return efficiently. `LuaTuple<T>` is mainly for
typing Roblox or existing Luau APIs. If a TypeScript function truly must emit multiple
returns for a Luau consumer, use `$tuple(...)`; otherwise return a named object.

### Truthiness and unavailable JavaScript APIs

Reason about source code using TypeScript/JavaScript truthiness: `0`, `""`, `false`,
`undefined`, and `NaN` are falsey. In particular, roblox-ts `assert(0)` and
`assert("")` fail even though Luau normally treats `0` and an empty string as truthy.

TypeScript syntax does not bring the browser or Node.js runtime into Roblox. Do not
use DOM, filesystem, Node networking, or arbitrary npm packages. Dependencies must be
designed for roblox-ts/Roblox (commonly published under `@rbxts`) or be proven to
compile without unavailable runtime APIs.

## Interoperating with existing Luau

roblox-ts can copy `.lua` files from `src` into `out`. A matching `.d.ts` file tells
TypeScript what the Luau module exports. Place it beside the Luau file with the same
base name; for `init.lua`, use `index.d.ts`.

```ts
// LegacyModule.d.ts for LegacyModule.lua
interface LegacyModule {
	calculateScore(player: Player): number;
}

declare const LegacyModule: LegacyModule;
export = LegacyModule;
```

This is a migration bridge, not the default for new code. A declaration file is only
a promise to the compiler; it does not validate that the Luau implementation really
matches.

## Agent completion checklist

Before finishing any gameplay code change after the TypeScript migration:

- Source changes are `.ts`/`.tsx`, not edits to generated `.lua` in `out`.
- Public functions, state, and network messages have precise domain types.
- No new `any`, unnecessary assertion (`as`), or non-null assertion (`!`) was added.
- Optional instances and untrusted values are narrowed or validated at runtime.
- Client input is validated and authorized on the server.
- Client code does not import server runtime code, and server code does not import
  client runtime code.
- DataModel declarations still match the actual Rojo/Studio hierarchy.
- `rbxtsc` completes without type errors.
- Rojo sync/build succeeds, and behavior is tested in the correct Studio context
  (server, client, or both).

## Primary references

- [roblox-ts Quick Start](https://roblox-ts.com/docs/quick-start/)
- [roblox-ts Setup Guide](https://roblox-ts.com/docs/setup-guide/)
- [roblox-ts Introduction](https://roblox-ts.com/docs/)
- [Roblox API typings and utility interfaces](https://roblox-ts.com/docs/api/roblox-api/)
- [roblox-ts utility types](https://roblox-ts.com/docs/api/utility-types/)
- [Syncing roblox-ts with Rojo](https://roblox-ts.com/docs/guides/syncing-with-rojo/)
- [roblox-ts GitHub repository](https://github.com/roblox-ts/roblox-ts)
- [`@rbxts/types` source repository](https://github.com/roblox-ts/types)

When this guide and the installed compiler disagree, the versions pinned in this
project's lockfile and their official documentation are authoritative. Update this
guide when the toolchain or project layout changes.
