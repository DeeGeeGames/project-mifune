# Horde Defense Prototype

Monorepo with parallel implementations of a 2D horde defense game.

## Structure

- `phaser/` — Phaser 3 + TypeScript + Vite + Bun implementation
- `godot/` — Godot implementation (in progress)

## Phaser Implementation (`phaser/`)

### Architecture

Functional core, Phaser shell. All game logic is pure functions on readonly data. Phaser integration is confined to `scene.ts` (update loop) and `render.ts` (sprite sync).

### File Map

- `phaser/src/types.ts` — All data types (Enemy, Turret, Runner, SpawnRegion, Resource, GameState, etc.)
- `phaser/src/config.ts` — All tunable constants (speeds, costs, ranges, scaling formulas)
- `phaser/src/state.ts` — Initial state, ID generator, wave constructors
- `phaser/src/scene.ts` — Phaser scene lifecycle, input handling, update loop order, camera setup
- `phaser/src/render.ts` — Sprite registry, world/HUD camera split, sync GameState to Phaser objects
- `phaser/src/main.ts` — Phaser.Game boot

#### Systems (`phaser/src/systems/`)

- `waves.ts` — Wave progression, spawn region creation and placement
- `regions.ts` — Region aging, enemy spawning from regions (with burst momentum)
- `combat.ts` — Movement (enemy homing + momentum blend), bullet/enemy/region hit detection, defense breach
- `turrets.ts` — Fire rate, turn rate, autonomous lead-targeting, placement validation
- `targeting.ts` — Shared utilities: distance, velocityToward, findNearest (generic), aim angle, lead-target intercept
- `runners.ts` — Runner AI state machine (idle/collecting/returning), resource pickup, runner death by enemy contact
- `resources.ts` — Resource drop on enemy death
- `input.ts` — Click-on-turret detection, control mode resolution

### Key Concepts

- **Control modes**: `none` (autonomous), `all` (player aims all turrets), `single` (one turret)
- **Economy**: Enemies drop resources on ground. Runners auto-collect from base. Currency buys turrets and runners.
- **Spawn regions**: Appear in world, emit enemies, destructible by player fire, expire after lifetime
- **Two cameras**: Main camera (world, zoomable/pannable) + HUD camera (fixed overlay)

### Controls

Left-click: place turret / fire (when controlling) | T: toggle control all | Click turret: control one | ESC: release | R: buy runner | Right-drag: pan | Scroll: zoom
