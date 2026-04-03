import type { EntityId, GameState, WaveState } from "./types.ts";
import {
	DEFENSE_HP,
	BASE_ENEMIES_PER_WAVE,
	ENEMIES_PER_WAVE_SCALING,
	BASE_SPAWN_INTERVAL,
	SPAWN_INTERVAL_DECAY,
	MIN_SPAWN_INTERVAL,
} from "./config.ts";

let nextId = 0;

export function makeId(): EntityId {
	nextId += 1;
	return `e${nextId}`;
}

function computeWaveEnemies(waveNumber: number): number {
	return BASE_ENEMIES_PER_WAVE + waveNumber * ENEMIES_PER_WAVE_SCALING;
}

function computeSpawnInterval(waveNumber: number): number {
	return Math.max(
		MIN_SPAWN_INTERVAL,
		BASE_SPAWN_INTERVAL * Math.pow(SPAWN_INTERVAL_DECAY, waveNumber),
	);
}

export function createInitialWave(): WaveState {
	return {
		waveNumber: 1,
		enemiesRemaining: computeWaveEnemies(1),
		spawnTimer: 0,
		spawnInterval: computeSpawnInterval(1),
		betweenWaves: false,
		intermissionTimer: 0,
	};
}

export function createNextWave(current: WaveState): WaveState {
	const next = current.waveNumber + 1;
	return {
		waveNumber: next,
		enemiesRemaining: computeWaveEnemies(next),
		spawnTimer: 0,
		spawnInterval: computeSpawnInterval(next),
		betweenWaves: false,
		intermissionTimer: 0,
	};
}

export function createInitialState(): GameState {
	return {
		turrets: [],
		enemies: [],
		bullets: [],
		controlMode: { tag: "none" },
		wave: createInitialWave(),
		defenseHp: DEFENSE_HP,
		gameOver: false,
	};
}
