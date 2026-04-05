import type { GameState, Vec2 } from "../types.ts";
import { tickWaves } from "./waves.ts";
import { tickRegions } from "./regions.ts";
import { tickTurrets } from "./turrets.ts";
import { tickMovement, tickCombat, tickDefense } from "./combat.ts";
import { tickResourceDrops } from "./resources.ts";
import { tickRunners, tickRunnerDeath } from "./runners.ts";
import { tickBlockDamage } from "./blocks.ts";

export type TickContext = {
	readonly pointerPosition: Vec2;
	readonly pointerDown: boolean;
	readonly time: number;
	readonly delta: number;
};

export function tickGameSystems(state: GameState, ctx: TickContext): GameState {
	const afterWaves = tickWaves(state, ctx.delta);
	const afterRegions = tickRegions(afterWaves, ctx.delta);
	const afterTurrets = tickTurrets(afterRegions, ctx.pointerPosition, ctx.pointerDown, ctx.time, ctx.delta);
	const afterMovement = tickMovement(afterTurrets, ctx.delta);

	const blockResult = tickBlockDamage(afterMovement);
	const combatResult = tickCombat(blockResult.state);

	const afterResources = tickResourceDrops(combatResult.state, [
		...blockResult.destroyedEnemyPositions,
		...combatResult.destroyedEnemyPositions,
	]);

	const afterRunners = tickRunners(afterResources, ctx.delta);
	const afterRunnerDeath = tickRunnerDeath(afterRunners);
	return tickDefense(afterRunnerDeath);
}
