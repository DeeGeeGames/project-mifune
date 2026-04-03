import type { Enemy, GameState } from "../types.ts";
import {
	ENEMY_HP,
	ENEMY_SPEED,
	CANVAS_WIDTH,
	GROUND_Y,
	TARGET_X,
	TARGET_Y,
	WAVE_INTERMISSION,
} from "../config.ts";
import { makeId, createNextWave } from "../state.ts";

const SPAWN_MARGIN = 40;

function randomPerimeterPoint(): { x: number; y: number } {
	// Spawn from top edge, or left/right sides above the ground
	const edge = Math.floor(Math.random() * 3); // 0=top, 1=right, 2=left
	const along = Math.random();
	return [
		{ x: SPAWN_MARGIN + along * (CANVAS_WIDTH - SPAWN_MARGIN * 2), y: -SPAWN_MARGIN },
		{ x: CANVAS_WIDTH + SPAWN_MARGIN, y: SPAWN_MARGIN + along * (GROUND_Y - SPAWN_MARGIN * 2) },
		{ x: -SPAWN_MARGIN, y: SPAWN_MARGIN + along * (GROUND_Y - SPAWN_MARGIN * 2) },
	][edge] ?? { x: CANVAS_WIDTH + SPAWN_MARGIN, y: GROUND_Y / 2 };
}

function velocityToward(from: { x: number; y: number }, speed: number): { x: number; y: number } {
	const dx = TARGET_X - from.x;
	const dy = TARGET_Y - from.y;
	const mag = Math.sqrt(dx * dx + dy * dy);
	return { x: (dx / mag) * speed, y: (dy / mag) * speed };
}

export function tickWaves(
	state: GameState,
	delta: number,
): { state: GameState; spawned: ReadonlyArray<Enemy> } {
	const wave = state.wave;

	if (wave.betweenWaves) {
		const remaining = wave.intermissionTimer - delta;
		if (remaining <= 0) {
			const nextWave = createNextWave(wave);
			return { state: { ...state, wave: nextWave }, spawned: [] };
		}
		return {
			state: { ...state, wave: { ...wave, intermissionTimer: remaining } },
			spawned: [],
		};
	}

	if (wave.enemiesRemaining <= 0) {
		if (state.enemies.length === 0) {
			return {
				state: {
					...state,
					wave: {
						...wave,
						betweenWaves: true,
						intermissionTimer: WAVE_INTERMISSION,
					},
				},
				spawned: [],
			};
		}
		return { state, spawned: [] };
	}

	const timer = wave.spawnTimer - delta;
	if (timer > 0) {
		return {
			state: { ...state, wave: { ...wave, spawnTimer: timer } },
			spawned: [],
		};
	}

	const position = randomPerimeterPoint();
	const velocity = velocityToward(position, ENEMY_SPEED);
	const enemy: Enemy = {
		id: makeId(),
		position,
		velocity,
		speed: ENEMY_SPEED,
		hp: ENEMY_HP,
	};

	return {
		state: {
			...state,
			wave: {
				...wave,
				enemiesRemaining: wave.enemiesRemaining - 1,
				spawnTimer: wave.spawnInterval,
			},
			enemies: [...state.enemies, enemy],
		},
		spawned: [enemy],
	};
}
