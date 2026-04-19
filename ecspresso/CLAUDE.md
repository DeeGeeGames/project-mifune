# ECSpresso Implementation

Isometric ship-fleet horde defense prototype. ECSpresso + three.js (via renderer3D) + Vite + Node.

Dependency: `file:../../ecspresso`. Pinned to `three@0.184.0` / `@types/three@0.184.0` to match the upstream ecspresso's resolved versions — mismatched patch versions produce duplicate-module type errors.

## Validation

```sh
npm run check:types
npm run dev
```

## Architecture

Plugin-factory pattern. All game-wide component / event / resource types are declared on the builder chain in `src/types.ts`. Feature plugins are created via `builder.pluginFactory()` (re-exported as `definePlugin`) and consume the plain object form: `definePlugin({ id, install })`.

Ships / enemies / projectiles are kinematic — movement is integrated manually inside feature plugins. We do **not** use `createPhysics3DPlugin`; collisions for bullets-vs-enemies are simple O(n·m) XZ circle checks in `combat.ts`.

Coordinate conventions:
- Ground plane is XZ, +Y is up.
- `ship.heading = 0` points in +Z (bow forward). `heading` is written into `localTransform3D.ry` each frame.
- Forward vector: `{ x: sin(heading), z: cos(heading) }`.

## File Map

- `src/types.ts` — builder chain, `GameAction` union, action map, all component/event/resource types, `definePlugin`, `World`
- `src/constants.ts` — all tunable numbers (ship specs, camera, turret, wave, summon costs, gamepad button indices)
- `src/math.ts` — pure helpers (`normalizeAngle`, `stepAngle`, `rotateY`, `bearingXZ`, `forwardXZ`, `leadTarget`)
- `src/kinematic.ts` — shared `integrateKinematicXZ(state, transform, dt)` used by both `movement.ts` (ships) and `enemy.ts` (enemies)
- `src/ships.ts` — `SHIP_SPECS` table per class + `createShipGroup` / `enemyShipGroup(kind)` / `projectileMesh` / `pickupMesh` factories
- `src/enemies.ts` — `EnemyKind` union (`pursuer | interceptor | flanker | orbiter`), `EnemyBehavior` discriminated union, `ENEMY_SPECS` stat/color table, `makeBehavior(kind)` factory
- `src/formation.ts` — pure helpers: `slotLocalXZ(slotIndex)` maps flat slot indices to a V formation (row 0 = front tip, row 1 = command row, each next row +2 slots); `reassignFormationSlots` repacks slots from `ownedShipIds` order.
- `src/main.ts` — install plugins, spawn initial corvette, add ground + lights, attach camera follow
- `src/plugins/` — feature plugins:
  - `cursor.ts` — mouse → ground-plane raycast; wheel → ortho zoom (TODO-noted shim until camera3D gains wheel-zoom for ortho)
  - `control.ts` — gamepad + keyboard/mouse → command-vessel `headingTarget` / `throttle`, summon events
  - `movement.ts` — per-ship rotation + thrust + drag + position integration (delegates to `kinematic.ts`)
  - `formation.ts` — non-flagship ships arrive-steer toward their V-formation slot (from `slotLocalXZ`)
  - `turret.ts` — aim (nearest in cone with lead-targeting) + fire (cooldown, spawn projectile). Autonomous only — player has no manual aim.
  - `combat.ts` — projectile integration, hit tests, enemy death → pickup spawn
  - `enemy.ts` — ship-like kinematics (shared integrator); per-`kind` AI dispatch (pursuer = tail-chase, interceptor = lead via `leadTarget`, flanker = lead + perpendicular offset, orbiter = ring-hold with periodic strikes)
  - `waves.ts` — interval-driven enemy spawns on a ring outside view, rate ramps over time
  - `pickups.ts` — magnet toward command vessel; collect on contact
  - `summon.ts` — listen for `summon:request`, deduct cost, spawn ship off-screen with `summonAnim`
  - `hud.ts` — DOM overlay updates each render phase
  - `aimPreview.ts` — aim-gate arc preview (see Controls)

## Key Patterns

- Export `builder` (pre-`.build()`) from `types.ts` so feature plugins use `definePlugin({id, install})`.
- Plugin creators are `createXPlugin() => definePlugin({...})` — called from `main.ts`.
- Ship turrets are separate entities with a `turret` component referencing their `ownerShipId`; `turret.mount` holds the three.js `Group` child so the aim system can rotate it in ship-local space.
- Heading is stored on `kinematic.heading` (world radians) and mirrored into `localTransform3D.ry`.
- Velocity lives on `kinematic.vx`/`vz` for ships and enemies, and on `projectile.vx`/`vz` for bullets — no physics3D.

## Controls

Player commands a carrier — slow, unarmed, depends entirely on its escort wing for firepower. Losing the carrier ends the run (loss-condition wiring pending).

Heading is gated: the ship only turns when the aim-gate is held. While held, stick/cursor drives `playerState.pendingHeading` (visualized as a dashed arc); release commits it to `ship.headingTarget`.

**Gamepad (primary):** LB held = aim gate (LS sets pending heading) · RT = forward · LT = reverse · A = summon selected · D-pad ◀▶ = cycle summon selection.

**Keyboard / mouse:** Left-mouse held = aim gate (mouse sets pending heading) · W/S = thrust · 1-4 = summon by class · Mouse wheel / Q-E = zoom.
