# Horde Defense Prototype

Monorepo with parallel implementations of a 2D horde defense game. See `docs/design.md` for gameplay design.

## Structure

- `phaser/` — Phaser 3 + TypeScript + Vite + Bun
- `godot/` — Godot 4 + GDScript

Each directory has its own `CLAUDE.md` with implementation-specific guidance.

Unless otherwise stated, assume changes are referring to `godot/` project

## CLAUDE.md Maintenance

When modifying the project, update the relevant `CLAUDE.md` file if the change affects:
- Directory structure or file organization
- Architectural patterns or conventions
- Key concepts, controls, or game mechanics
- Build/run/validation commands

Keep these files as lightweight indexes pointing to where information lives in the codebase, not as duplicates of that information.
