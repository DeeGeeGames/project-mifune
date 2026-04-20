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

- `src/types.ts` — builder chain, `GameAction` union, action map, all component/event/resource types, screens (`title` / `loadoutSelect` / `playing` / `waveSummary`), `definePlugin`, `World`
- `src/constants.ts` — all tunable numbers (ship specs, camera, turret, wave duration/spawn-interval curve, summon costs, gamepad button indices)
- `src/waveMath.ts` — pure wave-number → duration / spawn-interval helpers, consumed by `types.ts` screen init and `plugins/waves.ts`
- `src/math.ts` — pure helpers (`normalizeAngle`, `stepAngle`, `rotateY`, `bearingXZ`, `forwardXZ`, `leadTarget`)
- `src/menu.ts` — pure helpers (`wrapIndex`, `renderMenuText`) shared by overlay-screen menu plugins.
- `src/kinematic.ts` — shared `integrateKinematicXZ(state, transform, dt)` used by both `movement.ts` (ships) and `enemy.ts` (enemies)
- `src/ships.ts` — `SHIP_SPECS` table per class + `createShipGroup` / `enemyShipGroup(kind)` / `projectileMesh` / `pickupMesh` factories
- `src/enemies.ts` — `EnemyKind` union (`pursuer | interceptor | flanker | orbiter`), `EnemyBehavior` discriminated union, `ENEMY_SPECS` stat/color table, `makeBehavior(kind)` factory
- `src/formation.ts` — pure helpers: `slotLocalXZ(slotIndex)` maps flat slot indices to a V formation (row 0 = front tip, row 1 = command row, each next row +2 slots); `reassignFormationSlots` repacks slots from `ownedShipIds` order.
- `src/main.ts` — install plugins, build hud refs, subscribe to `screenEnter`/`screenExit` to spawn carrier / tear down sim between waves, boot into `title` screen
- `src/plugins/` — feature plugins:
  - `cursor.ts` — mouse → ground-plane raycast; wheel → ortho zoom (TODO-noted shim until camera3D gains wheel-zoom for ortho)
  - `cameraLead.ts` — writes `camera3DState.followOffsetX/Z` each frame so the camera leads the carrier. Lead direction = `heading_unit + velocity/maxSpeed`; base magnitude scales with |sum|, then a `charge` value (0..1) creeps the magnitude toward `CAMERA_LEAD_MAX` while aligned, bleeding off proportional to misalignment. Runs at priority 410 in `postUpdate` (before `camera3d-follow`).
  - `control.ts` — gamepad + keyboard/mouse → command-vessel `headingTarget` / `throttle`, summon events
  - `movement.ts` — per-ship rotation + thrust + drag + position integration (delegates to `kinematic.ts`)
  - `formation.ts` — non-flagship ships arrive-steer toward their V-formation slot (from `slotLocalXZ`)
  - `turret.ts` — aim (nearest in cone with lead-targeting) + fire (cooldown, spawn projectile). Autonomous only — player has no manual aim.
  - `combat.ts` — projectile integration, hit tests, enemy death → pickup spawn
  - `enemy.ts` — ship-like kinematics (shared integrator); per-`kind` AI dispatch (pursuer = tail-chase, interceptor = lead via `leadTarget`, flanker = lead + perpendicular offset, orbiter = ring-hold with periodic strikes)
  - `waves.ts` — within-`playing`-screen spawn loop; on timer expiry triggers `setScreen('waveSummary')`. Also owns the `enemy:killed` / `pickup:collected` listeners that accumulate per-wave stats into the playing screen state.
  - `pickups.ts` — magnet toward command vessel; collect on contact
  - `summon.ts` — listen for `summon:request`, deduct cost, spawn ship off-screen with `summonAnim`
  - `hud.ts` — in-game DOM overlay updates each render phase (gated to `playing`); toggles `gameHudEls` visibility on `screenEnter`/`screenExit('playing')`.
  - `aimPreview.ts` — aim-gate arc preview (see Controls)
  - `waveSummary.ts` — between-wave screen: toggles `summaryEl` visibility on `screenEnter`/`screenExit('waveSummary')` + menu input/render system gated to `waveSummary`. Selecting `Continue` triggers `setScreen('playing', { waveNumber: n + 1 })`.
  - `titleScreen.ts` — placeholder title screen: toggles `titleEl` visibility on `screenEnter`/`screenExit('title')` + menu input/render system gated to `title`. Start → `setScreen('loadoutSelect', {})`; Quit → `window.close()`.
  - `loadoutSelect.ts` — pre-game weapon loadout screen. On enter: spawns a non-simulated preview carrier at origin, attaches per-pylon arc visualizers (min/max boundary lines + facing indicator), unfollows camera. Menu rows derived each tick from `carrierLoadout` resource (one weapon row per pylon + facing row when weapon != None + Back + Start). Left/Right on weapon rows cycle `None→Turret→Cannon→Beam→None`; on facing rows step facing by π/4 clamped to `pylonArc(mount)` with wrap. Selecting Start → `setScreen('playing', { waveNumber: 1 })`, Back → `title`. Preview rebuilt from scratch on any loadout or selection change.

## Key Patterns

- Export `builder` (pre-`.build()`) from `types.ts` so feature plugins use `definePlugin({id, install})`.
- Plugin creators are `createXPlugin() => definePlugin({...})` — called from `main.ts`.
- Ship turrets are separate entities with a `turret` component referencing their `ownerShipId`; `turret.mount` holds the three.js `Group` child so the aim system can rotate it in ship-local space.
- Heading is stored on `kinematic.heading` (world radians) and mirrored into `localTransform3D.ry`.
- Velocity lives on `kinematic.vx`/`vz` for ships and enemies, and on `projectile.vx`/`vz` for bullets — no physics3D.
- Round structure lives in screen state, not a resource: the `playing` screen's state owns `waveNumber`, `phaseTimer`, `spawnTimer`, per-wave `kills` / `resourcesCollected`. `waveSummary` screen carries `waveNumber` / `kills` / `resourcesCollected` forward for display plus a `selectedIndex` for the menu. Only `playerState.resources` is global and carries across waves — everything else (carrier, allied ships, pickups, projectiles) is torn down on `playing.onExit` and respawned fresh on the next `playing.onEnter`.
- All simulation systems are gated with `.inScreens(['playing'])` so they pause during overlay screens. Always-on systems: renderer, camera, input, behavior-tree (plugin-internal), cursor. Screen-overlay visibility is event-driven via `screenEnter`/`screenExit` subscriptions per plugin, not polled in the render loop.

## Controls

**Design principle: gamepad is the primary input.** Keyboard/mouse is a secondary fallback. When adding or modifying input-facing features, design the gamepad binding first and ensure the full game is playable on a controller alone; keyboard/mouse mappings come after and must not enable any interaction the gamepad can't reach. New `GameAction`s should always have a gamepad binding.

Player commands a carrier — slow, with four configurable weapon pylons chosen on the `loadoutSelect` screen before the run (no default weapons). Depends on its escort wing for most firepower. Losing the carrier ends the run (loss-condition wiring pending). Pylon positions and per-category firing-arc restrictions live in `SHIP_SPECS.carrier.emptyTurretMounts` + `pylonArc()` in `src/ships.ts`. The chosen loadout persists across waves in the `carrierLoadout` resource but resets on page reload.

Heading is gated: the ship only turns when the aim-gate is held. While held, stick/cursor drives `playerState.pendingHeading` (visualized as a dashed arc); release commits it to `ship.headingTarget`.

**Gamepad (primary):** LB held = aim gate (LS sets pending heading) · RT = forward · LT = reverse · A = summon selected · D-pad ◀▶ = cycle summon selection.

**Keyboard / mouse (secondary):** Left-mouse held = aim gate (mouse sets pending heading) · W/S = thrust · 1-4 = summon by class · Mouse wheel / Q-E = zoom.

**Wave summary screen:** D-pad / arrow keys = `menuUp`/`menuDown` navigate · A button / Enter / Space = `menuConfirm` activate.
