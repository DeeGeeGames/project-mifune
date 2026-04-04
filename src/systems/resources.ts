import type { GameState, Resource, Vec2 } from "../types.ts";
import { GROUND_Y, RESOURCE_DROP_VALUE } from "../config.ts";
import { makeId } from "../state.ts";

export function tickResourceDrops(
	state: GameState,
	deathPositions: ReadonlyArray<Vec2>,
): GameState {
	if (deathPositions.length === 0) return state;

	const newResources = deathPositions.map((pos): Resource => ({
		id: makeId(),
		position: { x: pos.x, y: GROUND_Y },
		value: RESOURCE_DROP_VALUE,
	}));

	return {
		...state,
		resources: [...state.resources, ...newResources],
	};
}
