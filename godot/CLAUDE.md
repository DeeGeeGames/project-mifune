# Godot Implementation

Godot 4 + GDScript. See `docs/godot-architecture.md` for the full architecture reference (scene tree, collision layers, signal flow, placement system).

## Architecture

Distributed mutable state across scene tree nodes. Global state lives in `GameManager` autoload singleton. Signals replace return values. Godot physics handles collision detection. Runner task acquisition is event-driven via the `JobBoard` autoload — producers push availability, consumers atomically claim, no per-frame group polling.

Prefer composition over inheritance: use child nodes (e.g. `TrackingArea`), Resources, and signals to share behavior rather than deepening class hierarchies. Keep base classes thin — only shared state and API that every subclass truly needs.

## File Map

- `scripts/autoload/game_manager.gd` — Global state, signal bus, input routing
- `scripts/autoload/constants.gd` — Shared constants
- `scripts/systems/job_board.gd` — Autoload. Resource & ammo job registry consumed by runners
- `scripts/components/tracking_area.gd` — `TrackingArea` reusable Area2D component for safe body enter/exit tracking with `tree_exiting` fallback. Used by enemies (aggro) and defenders (range).
- `scripts/components/health_component.gd` — `HealthComponent` reusable Node component for HP state, damage, and death signals. Used by EnemyBase, Spawner, Soldier, and Block.
- `scripts/entities/enemy_base.gd` — `EnemyBase` shared parent for Enemy/Walker (targeting helper, damage/death API). HP via HealthComponent child, runner proximity via TrackingArea child.
- `scripts/entities/defender.gd` — `Defender` shared parent for Turret/Soldier (ammo, fire timer + routine, runner-claim API, JobBoard hooks). Enemy proximity via TrackingArea child.
- `scripts/entities/spawner_base.gd` — `Spawner` Area2D for enemy-producing regions; behavior driven entirely by a `SpawnerConfig` resource (hp, lifetime, cadence, draw colors, optional burst momentum). Both `spawn_region.tscn` and `walker_spawner.tscn` use this same script with different configs.
- `scripts/entities/` — Per-entity scripts (enemy, walker, turret, soldier, bullet, spawner_base, block, runner, resource_pickup, base)
- `scripts/systems/` — Shared utilities (targeting, wave_manager, placement_manager, draw_utils)
- `scripts/hud/` — HUD scripts (hud, build_menu, game_over_overlay)
- `scripts/resources/` — Custom Resource types for entity configuration (*_config.gd)
- `scenes/` — .tscn scene files (main, entities, hud)
- `resources/defaults/` — Default .tres resource instances

## Key Concepts

- **Collision layers**: Defined in `docs/godot-architecture.md` (terrain, base, blocks, enemies, bullets, resources, runners, turret_range)
- **Placement**: Modal flow managed by GameManager (placing -> aiming -> confirm)
- **Entity config**: Custom Resource types in `scripts/resources/` with default .tres in `resources/defaults/`
