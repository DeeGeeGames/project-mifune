import type { Enemy, GameState, SpawnRegion } from "../types.ts";
import {
	ENEMY_HP,
	ENEMY_SPEED,
	ENEMY_SPAWN_BURST_SPEED,
	TARGET_X,
	TARGET_Y,
} from "../config.ts";
import { makeId } from "../state.ts";
import { velocityToward } from "./targeting.ts";

const TARGET_POS = { x: TARGET_X, y: TARGET_Y };

function spawnEnemy(region: SpawnRegion): Enemy {
	const offsetAngle = Math.random() * Math.PI * 2;
	const offsetDist = Math.random() * region.radius;
	const position = {
		x: region.position.x + Math.cos(offsetAngle) * offsetDist,
		y: region.position.y + Math.sin(offsetAngle) * offsetDist,
	};

	const burstAngle = region.burstArcCenter + (Math.random() * 2 - 1) * (region.burstArcWidth / 2);
	const burstSpeed = ENEMY_SPAWN_BURST_SPEED * (0.5 + Math.random() * 0.5);

	return {
		id: makeId(),
		position,
		velocity: velocityToward(position, TARGET_POS, ENEMY_SPEED),
		speed: ENEMY_SPEED,
		hp: ENEMY_HP,
		spawnMomentum: {
			x: Math.cos(burstAngle) * burstSpeed,
			y: Math.sin(burstAngle) * burstSpeed,
		},
		momentumFactor: 1,
	};
}

export function tickRegions(state: GameState, delta: number): GameState {
	const newEnemies: Enemy[] = [];

	const regions = state.regions
		.map((region) => {
			const age = region.age + delta;
			if (age >= region.lifetime) return null;

			const spawnTimer = region.spawnTimer - delta;
			if (spawnTimer > 0) return { ...region, age, spawnTimer };

			newEnemies.push(spawnEnemy(region));
			return { ...region, age, spawnTimer: region.spawnInterval };
		})
		.filter((r): r is NonNullable<typeof r> => r !== null);

	return {
		...state,
		regions,
		enemies: [...state.enemies, ...newEnemies],
	};
}
