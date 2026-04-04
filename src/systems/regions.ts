import type { Enemy, GameState } from "../types.ts";
import {
	ENEMY_HP,
	ENEMY_SPEED,
	REGION_SPAWN_SPREAD,
	TARGET_X,
	TARGET_Y,
} from "../config.ts";
import { makeId } from "../state.ts";

function velocityToward(from: { x: number; y: number }, speed: number): { x: number; y: number } {
	const dx = TARGET_X - from.x;
	const dy = TARGET_Y - from.y;
	const mag = Math.sqrt(dx * dx + dy * dy);
	return { x: (dx / mag) * speed, y: (dy / mag) * speed };
}

export function tickRegions(
	state: GameState,
	delta: number,
): { state: GameState; spawnedEnemies: ReadonlyArray<Enemy>; expiredIds: ReadonlyArray<string> } {
	const spawnedEnemies: Enemy[] = [];
	const expiredIds: string[] = [];

	const updatedRegions = state.regions
		.map((region) => {
			const age = region.age + delta;

			if (age >= region.lifetime) {
				expiredIds.push(region.id);
				return null;
			}

			const spawnTimer = region.spawnTimer - delta;
			if (spawnTimer > 0) {
				return { ...region, age, spawnTimer };
			}

			// Spawn an enemy with a small random offset from region center
			const offsetAngle = Math.random() * Math.PI * 2;
			const offsetDist = Math.random() * REGION_SPAWN_SPREAD;
			const spawnPos = {
				x: region.position.x + Math.cos(offsetAngle) * offsetDist,
				y: region.position.y + Math.sin(offsetAngle) * offsetDist,
			};
			const velocity = velocityToward(spawnPos, ENEMY_SPEED);

			spawnedEnemies.push({
				id: makeId(),
				position: spawnPos,
				velocity,
				speed: ENEMY_SPEED,
				hp: ENEMY_HP,
			});

			return { ...region, age, spawnTimer: region.spawnInterval };
		})
		.filter((r): r is NonNullable<typeof r> => r !== null);

	return {
		state: {
			...state,
			regions: updatedRegions,
			enemies: [...state.enemies, ...spawnedEnemies],
		},
		spawnedEnemies,
		expiredIds,
	};
}
