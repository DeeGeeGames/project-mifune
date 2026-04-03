import type { Enemy, GameState } from "../types.ts";
import {
	ENEMY_HP,
	ENEMY_SPEED,
	SPAWN_X,
	SPAWN_Y_MIN,
	SPAWN_Y_MAX,
	WAVE_INTERMISSION,
} from "../config.ts";
import { makeId, createNextWave } from "../state.ts";

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
			state: {
				...state,
				wave: { ...wave, intermissionTimer: remaining },
			},
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

	const y = SPAWN_Y_MIN + Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN);
	const enemy: Enemy = {
		id: makeId(),
		position: { x: SPAWN_X, y },
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
