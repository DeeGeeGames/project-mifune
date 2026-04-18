# Phaser Implementation

Phaser 3 + TypeScript + Vite + Node.

## Validation

```sh
npm run check        # or check:types
```

## Architecture

Functional core, Phaser shell. All game logic is pure functions on readonly data. Phaser integration is confined to `src/scene.ts` (update loop) and `src/render.ts` (sprite sync).

## File Map

- `src/types.ts` — All data types
- `src/config.ts` — All tunable constants (speeds, costs, ranges, scaling formulas)
- `src/state.ts` — Initial state, ID generator, wave constructors
- `src/scene.ts` — Phaser scene lifecycle, input handling, update loop, camera setup
- `src/render.ts` — Sprite registry, world/HUD camera split, sync GameState to Phaser objects
- `src/main.ts` — Phaser.Game boot
- `src/systems/` — Pure game logic (waves, regions, combat, turrets, targeting, runners, resources, input, blocks, placement, gameLoop)

## Key Concepts

- **Control modes**: `none` (autonomous), `all` (player aims all turrets), `single` (one turret)
- **Economy**: Enemies drop resources. Runners auto-collect. Currency buys turrets, blocks, and runners.
- **Spawn regions**: Appear in world, emit enemies, destructible, expire after lifetime
- **Two cameras**: Main camera (world, zoomable/pannable) + HUD camera (fixed overlay)

## Controls

Left-click: place/fire | T: toggle control all | Click turret: control one | ESC: release | R: buy runner | Right-drag: pan | Scroll: zoom
