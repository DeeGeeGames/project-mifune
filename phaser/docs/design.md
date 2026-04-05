# Horde Defense - Game Design

## Overview

A 2D horde defense game where the player builds and manages a base under siege from waves of enemies. The core loop alternates between frantic combat and strategic building during intermissions. The player balances direct combat involvement against autonomous defense, managing an economy driven by physical resource collection.

## Core Loop

1. **Enemies spawn** from temporary regions that appear in the world each wave
2. **Turrets fire** autonomously or under player control to destroy enemies and spawn regions
3. **Enemies drop resources** on death, which litter the battlefield
4. **Runners collect** resources and return them to base, converting them into currency
5. **Player spends currency** on turrets, blocks, and runners to prepare for the next wave
6. Waves escalate in intensity. The game ends when the base is destroyed.

## Combat

### Turrets

Turrets are the primary weapon. Each turret has a coverage arc that limits its firing angle. When autonomous, turrets use lead-targeting to predict enemy movement and fire automatically at enemies within their arc. The player can override this by taking direct aim control.

Turrets have limited ammo and must be resupplied by runners.

#### Placement

Turrets can be placed on the ground or on exposed faces of blocks (top, left, right). When placing, the player first chooses a position, then aims to set the arc's center direction. The arc width can be adjusted with the scroll wheel during placement.

### Enemies

Enemies home toward the base. When spawned from a region, they carry burst momentum that scatters them outward before they begin homing. Enemies will divert to chase nearby runners if within aggro range.

Enemies that reach the base deal damage equal to their remaining HP. If the base HP reaches zero, the game is over.

### Spawn Regions

Spawn regions are destructible zones that appear in the world during waves. They continuously emit enemies for their lifetime. Regions can be destroyed by shooting them, cutting off enemy production early. Each wave introduces more regions, and regions grow stronger (more HP, faster spawning, larger area) as waves progress.

Regions have a directional burst arc that gives spawned enemies their initial momentum direction.

## Economy

### Resources

Defeated enemies drop resource pickups on the ground. These are not collected automatically -- runners must physically travel to them and carry them back to base.

### Currency

Currency is the single resource used for all purchases:
- **Turrets** -- primary defense
- **Blocks** -- structural building pieces
- **Runners** -- resource collectors and ammo carriers

### Runners

Runners are autonomous units that operate from the base. They have two task types, prioritized by a player-togglable setting:

- **Resource collection**: travel to a dropped resource, pick it up, return to base to deposit as currency
- **Ammo resupply**: travel from base to a turret that is low on ammo and reload it

Runners are fragile (1 HP) and die on contact with enemies. They are a key investment -- more runners means faster economy, but each one is at risk.

## Building

### Blocks

Blocks are structural units that snap to a grid. They can be placed adjacent to existing blocks or on the ground. Blocks have HP and are destroyed by enemy contact (enemies that collide with blocks deal their full HP as damage and are destroyed in the process).

Turrets mounted on a block are destroyed if the block is destroyed.

Blocks serve as both elevated turret platforms and physical barriers against enemy approach.

## Player Control Modes

The player has three control modes for turrets:

- **Autonomous** (default) -- all turrets aim and fire on their own using lead-targeting
- **Control all** -- the player aims all turrets simultaneously toward the cursor; they fire on click
- **Control single** -- the player aims one selected turret toward the cursor; others remain autonomous

While controlling turrets, the player cannot place buildings.

## Waves

Waves are the pacing mechanism. Each wave spawns a number of regions over time. Once all regions have expired or been destroyed and all enemies are eliminated, an intermission begins before the next wave.

Wave progression increases:
- Number of spawn regions per wave
- Region HP, lifetime, size, and spawn rate

There is a cap on concurrent active regions to keep the battlefield readable.

## Camera

The world is larger than the viewport. The player can pan (right-drag or WASD/arrow keys) and zoom (scroll wheel) to survey the battlefield.

## Controls

| Input | Action |
|---|---|
| Left-click | Place building / fire (when controlling turrets) |
| Scroll wheel | Zoom camera / adjust arc width during turret placement |
| Right-drag | Pan camera |
| WASD / Arrow keys | Pan camera |
| T | Toggle control-all mode |
| Click on turret | Enter single-turret control |
| ESC | Release turret control / cancel placement |
| P | Toggle runner priority (resources vs ammo) |
| Build menu | Select turret, block, or runner to purchase |
