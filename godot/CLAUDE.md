# Godot Implementation

Godot 4 + GDScript. See `docs/godot-architecture.md` for the full architecture reference (scene tree, collision layers, signal flow, placement system).

## Architecture

Distributed mutable state across scene tree nodes. Global state lives in `GameManager` autoload singleton. Signals replace return values. Godot physics handles collision detection.

## File Map

- `scripts/autoload/game_manager.gd` — Global state, signal bus, wave sequencing, input routing
- `scripts/autoload/constants.gd` — Shared constants
- `scripts/entities/` — Per-entity scripts (enemy, turret, bullet, spawn_region, block, runner, soldier, resource_pickup, base)
- `scripts/systems/` — Shared utilities (targeting, wave_manager, placement_manager, draw_utils)
- `scripts/hud/` — HUD scripts (hud, build_menu, game_over_overlay)
- `scripts/resources/` — Custom Resource types for entity configuration (*_config.gd)
- `scenes/` — .tscn scene files (main, entities, hud)
- `resources/defaults/` — Default .tres resource instances

## Key Concepts

- **Collision layers**: Defined in `docs/godot-architecture.md` (terrain, base, blocks, enemies, bullets, resources, runners, turret_range)
- **Placement**: Modal flow managed by GameManager (placing -> aiming -> confirm)
- **Entity config**: Custom Resource types in `scripts/resources/` with default .tres in `resources/defaults/`
