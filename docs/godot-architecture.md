# Godot Implementation Architecture

Implementation guide for porting the horde defense prototype to Godot 4 with GDScript. This document maps gameplay systems from [design.md](design.md) to Godot's node, scene, and signal model.

## Architectural Shift

The prototype uses a functional-core architecture: a single immutable `GameState` updated by pure functions each frame, with rendering as a separate sync pass. Godot's model is fundamentally different -- state is distributed across mutable nodes in a scene tree, and behavior lives on the nodes themselves via attached scripts. This port embraces that model fully.

Key differences:
- **No central state object.** Each entity node owns its own state (hp, position, velocity, etc.).
- **Global state lives in an autoload.** Currency, wave progression, control mode, game-over flag, and runner priority are managed by a `GameManager` singleton.
- **Signals replace return values.** Where the prototype returns updated state, Godot nodes emit signals (e.g., enemy death emits a signal that triggers resource spawning).
- **Physics replaces manual math.** Collision detection, hit testing, and body movement use Godot's built-in Area2D/CharacterBody2D/StaticBody2D nodes.
- **Timers replace manual countdowns.** Spawn intervals, fire rate cooldowns, and wave intermissions use Timer nodes.

## Scene Tree

```
Main (Node2D)
├── GameManager (autoload singleton)
├── World (Node2D)
│   ├── Terrain (Node2D or TileMap)
│   ├── Base (Area2D)
│   ├── Blocks (Node2D)                 ← container
│   │   └── Block (StaticBody2D)        ← scene instance
│   ├── Turrets (Node2D)                ← container
│   │   └── Turret (Node2D)             ← scene instance
│   ├── Enemies (Node2D)                ← container
│   │   └── Enemy (CharacterBody2D)     ← scene instance
│   ├── Bullets (Node2D)                ← container
│   │   └── Bullet (Area2D)             ← scene instance
│   ├── SpawnRegions (Node2D)           ← container
│   │   └── SpawnRegion (Area2D)        ← scene instance
│   ├── Resources (Node2D)              ← container
│   │   └── ResourcePickup (Area2D)     ← scene instance
│   └── Runners (Node2D)                ← container
│       └── Runner (CharacterBody2D)    ← scene instance
├── Camera (Camera2D)
└── HUD (CanvasLayer)
    ├── StatsPanel (VBoxContainer)
    ├── BuildMenu (VBoxContainer)
    ├── WaveLabel (Label)
    ├── InstructionLabel (Label)
    └── GameOverOverlay (Control)
```

Entity containers (`Blocks`, `Turrets`, `Enemies`, etc.) are plain Node2D nodes that serve as parents for instanced scenes. This keeps the tree organized and makes it easy to iterate over all entities of a type via `get_children()`.

## Collision Layers

Godot's physics uses bitmask layers and masks to control what interacts with what.

| Layer | Name | Used By |
|-------|------|---------|
| 1 | terrain | Ground/terrain colliders |
| 2 | base | Base Area2D |
| 3 | blocks | Block StaticBody2D |
| 4 | enemies | Enemy CharacterBody2D |
| 5 | bullets | Bullet Area2D |
| 6 | resources | ResourcePickup Area2D |
| 7 | runners | Runner CharacterBody2D |
| 8 | turret_range | Turret detection Area2D |

Collision masks (what each layer detects):

| Node | Layer | Mask |
|------|-------|------|
| Bullet | 5 | 4 (enemies), 3 (blocks region hp via area) |
| Enemy | 4 | 2 (base), 3 (blocks), 7 (runners) |
| Runner | 7 | 6 (resources) |
| Turret range | 8 | 4 (enemies) |
| Base | 2 | 4 (enemies) |
| Block | 3 | 4 (enemies) |
| ResourcePickup | 6 | 7 (runners) |

## GameManager Autoload

A singleton autoload script that holds global state and acts as a signal bus.

### State
- `currency: int`
- `wave_number: int`
- `defense_hp: int`
- `control_mode: Dictionary` (tag + optional turret reference)
- `runner_priority: String` ("resources" or "ammo")
- `game_over: bool`
- `placement_state: Dictionary` (tag + placement data)

### Signals
- `currency_changed(new_amount)`
- `defense_damaged(new_hp)`
- `game_over_triggered`
- `wave_started(wave_number)`
- `wave_cleared`
- `control_mode_changed(mode)`
- `runner_priority_changed(priority)`
- `placement_state_changed(state)`

### Responsibilities
- Processes input for global actions (toggle control mode, escape, priority toggle, build menu selection)
- Manages wave sequencing (see [Waves](#waves))
- Tracks and broadcasts currency changes
- Coordinates placement flow

## Entity Scenes

### Enemy

**Scene root:** `CharacterBody2D`

**Children:**
- `CollisionShape2D` (circle)
- `Sprite2D` or `AnimatedSprite2D`

**Script behavior:**
- Moves toward the base position each frame using `move_and_slide()`
- Blends a spawn momentum vector with homing velocity, decaying momentum over time
- Diverts toward nearby runners when within aggro range (use distance check against runner group, or a small Area2D)
- On `body_entered` with base → deal damage equal to remaining HP, then `queue_free()`
- On `body_entered` with block → deal HP as damage to block, then `queue_free()`

**On death (HP reaches 0):**
- Emit signal or directly instance a ResourcePickup at current position
- `queue_free()`

### Turret

**Scene root:** `Node2D`

**Children:**
- `Sprite2D` (base + barrel, or separate barrel as child that rotates)
- `RangeArea (Area2D)` with `CollisionShape2D` (circle, radius = turret range)
- `FireTimer (Timer)` (one-shot, wait_time = 1/fire_rate)

**Script behavior:**
- `RangeArea` tracks enemies entering/exiting the arc (filter by angle on `body_entered`/`body_exited`, or maintain a list and filter each frame)
- **Autonomous mode:** Picks the nearest enemy within arc, computes lead-target intercept, rotates barrel toward it at turn speed, fires when aimed and timer is ready
- **Controlled mode:** Rotates barrel toward mouse cursor, fires on click when timer is ready
- Arc constraints: barrel rotation is clamped to the turret's arc range; autonomous targeting only considers enemies within the arc
- Fires by instancing a Bullet scene at barrel tip with velocity in barrel direction (plus spread)
- Tracks ammo count; stops firing when empty

**Stored state:**
- `arc_center: float`
- `arc_width: float`
- `arc_range: Dictionary` (center + width, the valid zone)
- `ammo: int`
- `parent_block_id` (reference or null)

### Bullet

**Scene root:** `Area2D`

**Children:**
- `CollisionShape2D` (circle)
- `Sprite2D` or `VisibleOnScreenNotifier2D`

**Script behavior:**
- Moves linearly at bullet speed each frame (`position += velocity * delta`)
- On `body_entered` with enemy → apply damage to enemy, `queue_free()`
- On `body_entered` with spawn region → apply damage to region, `queue_free()`
- Despawns when leaving the world bounds (use `VisibleOnScreenNotifier2D` or manual bounds check)

### SpawnRegion

**Scene root:** `Area2D`

**Children:**
- `CollisionShape2D` (circle, radius = region radius)
- `SpawnTimer (Timer)` (repeating, wait_time = spawn interval)
- Visual representation (particles, animated sprite, or draw call)

**Script behavior:**
- `SpawnTimer.timeout` → instance an Enemy at a random position within radius, apply burst momentum based on region's arc
- Ages over time; `queue_free()` when age exceeds lifetime
- Takes damage from bullets (tracked via HP); `queue_free()` when destroyed
- Visual pulsing/color shift based on HP and remaining lifetime

**Scaling with wave number** (set at instantiation):
- Lifetime, HP, radius, and spawn interval are computed from wave number using the same formulas as the prototype

### Block

**Scene root:** `StaticBody2D`

**Children:**
- `CollisionShape2D` (rectangle, BLOCK_SIZE x BLOCK_SIZE)
- `Sprite2D`
- HP bar (TextureProgressBar or custom draw)

**Script behavior:**
- Takes damage when enemies collide (enemy deals its full HP as damage, enemy is destroyed)
- On destruction: emits signal with block ID so turrets mounted on this block can be removed
- Snap-to-grid placement is handled by the placement system, not the block itself

**Turret mounting:**
- Turrets placed on block faces store a reference to the parent block
- When a block is destroyed, it emits `block_destroyed(block_id)`; turrets listen and `queue_free()` if their parent matches

### ResourcePickup

**Scene root:** `Area2D`

**Children:**
- `CollisionShape2D` (circle, small radius)
- `Sprite2D`

**Script behavior:**
- Passive. Exists at a position on the ground until a runner picks it up.
- Runners detect overlap via their own area or by checking distance. On pickup, the resource emits `collected(value)` and calls `queue_free()`.

### Runner

**Scene root:** `CharacterBody2D`

**Children:**
- `CollisionShape2D` (small rectangle or circle)
- `Sprite2D` or `AnimatedSprite2D`

**Script behavior — state machine:**

```
idle → collecting → returning → idle
idle → resupplying → idle
```

- **idle:** Look for a task. Based on `GameManager.runner_priority`, prefer either resource collection or ammo resupply. Pick the nearest unclaimed target. Transition to `collecting` or `resupplying`.
- **collecting:** Move toward target resource. On arrival (overlap), pick it up (resource calls `queue_free()`), transition to `returning` with carried value.
- **returning:** Move toward base. On arrival, add carried value to `GameManager.currency`, transition to `idle`.
- **resupplying:** Move toward a turret that needs ammo. On arrival, reload the turret, transition to `idle`.

**Death:** Runner has 1 HP. Any enemy contact kills it. On `body_entered` with enemy → `queue_free()`. Carried resources are lost.

**Task claiming:** Runners need to avoid multiple runners targeting the same resource or turret. Options:
- A shared set on `GameManager` tracking claimed target IDs
- Or a `claimed_by` property on resource/turret nodes

### Base

**Scene root:** `Area2D`

**Children:**
- `CollisionShape2D` (circle, radius = base radius)
- `Sprite2D`
- HP bar

**Script behavior:**
- On `body_entered` with enemy → reduce `GameManager.defense_hp` by enemy HP, signal the enemy to destroy itself
- When HP reaches 0 → `GameManager.game_over = true`, emit `game_over_triggered`

## Waves

Wave management lives in `GameManager`. Each wave defines how many regions to spawn and at what interval.

**Flow:**
1. Wave starts → `regions_to_spawn` is set based on wave number
2. A Timer fires at `WAVE_REGION_SPAWN_INTERVAL` → instances a SpawnRegion scene in the world, decrements `regions_to_spawn`
3. Pauses spawning if concurrent region count is at cap
4. When `regions_to_spawn` reaches 0 and all regions and enemies are gone → intermission begins
5. Intermission Timer fires → next wave starts (increment wave number, recompute region params)

Region parameters scale with wave number:
- More regions per wave
- Higher HP, longer lifetime, larger radius, faster spawn rate (all clamped to caps)

## Placement System

Placement is a modal UI flow managed by `GameManager`. The flow for turrets:

1. Player clicks "Turret" in build menu → enter `placing_turret` state
2. Ghost turret follows cursor, snapping to valid positions (ground level or block faces)
3. Player clicks a valid position → enter `aiming` state at that position
4. Ghost arc preview follows cursor; scroll wheel adjusts arc width
5. Player clicks to confirm → instance Turret scene, deduct currency
6. If enough currency remains, stay in `placing_turret`; otherwise return to `idle`

Block placement:
1. Player clicks "Block" in build menu → enter `placing_block` state
2. Ghost block follows cursor, snapping to grid (adjacent to existing blocks or on ground)
3. Player clicks a valid position → instance Block scene, deduct currency
4. Repeats while currency remains

**ESC or T** cancels any placement mode.

Ghost previews (semi-transparent turret/block/arc at cursor) are drawn via a dedicated preview node that is updated each frame during placement.

## Camera

A `Camera2D` node with a script handling:
- **Zoom:** Mouse scroll wheel adjusts `zoom`, clamped between min/max. Zoom is focused toward the cursor position.
- **Pan (drag):** Right-click drag adjusts camera `offset` or `position` based on drag delta, scaled by current zoom.
- **Pan (keys):** WASD / arrow keys move camera at a fixed speed, scaled by zoom.
- Camera is bounded to the world rect via `limit_left`, `limit_right`, `limit_top`, `limit_bottom`.

During turret `aiming` state, scroll input is captured by the placement system (arc width adjustment) instead of the camera.

## HUD

A `CanvasLayer` ensures HUD elements are not affected by camera zoom/pan.

**Elements:**
- **Stats panel** (top-left): Defense HP, wave info, turret count, control mode, currency, runner count, runner priority
- **Build menu** (right side): Buttons for Turret, Block, Runner with cost labels. Buttons are enabled/disabled based on currency and game state. Active placement mode is highlighted.
- **Instruction bar** (bottom center): Context-sensitive hint text based on current placement/control state
- **Game over overlay**: Shown when `game_over_triggered` fires

Build menu buttons connect to `GameManager` to trigger placement mode changes and runner purchases.

## Signal Flow

Key signal chains showing how events propagate:

```
Enemy HP reaches 0
  → Enemy emits enemy_died(position)
  → World spawns ResourcePickup at position
  → Enemy queue_free()

Bullet enters Enemy area
  → Enemy takes damage
  → (if dead, see above)
  → Bullet queue_free()

Enemy enters Base area
  → GameManager.defense_hp reduced
  → Enemy queue_free()
  → (if hp <= 0) GameManager emits game_over_triggered
  → HUD shows game over

Enemy enters Block body
  → Block takes damage (enemy HP as damage)
  → Enemy queue_free() + triggers resource drop
  → (if block destroyed) Block emits block_destroyed
  → Mounted turrets queue_free()

Runner overlaps ResourcePickup
  → ResourcePickup emits collected(value)
  → Runner transitions to returning state
  → ResourcePickup queue_free()

Runner arrives at Base
  → GameManager.currency increased
  → GameManager emits currency_changed
  → HUD updates

All enemies + regions gone, regions_to_spawn == 0
  → GameManager starts intermission timer
  → Timer fires → next wave
```
