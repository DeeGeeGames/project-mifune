import type { SpawnRegion, GameState } from "../types.ts";
import {
	WORLD_WIDTH,
	GROUND_Y,
	TARGET_X,
	TARGET_Y,
	REGION_SAFE_RADIUS,
	REGION_BASE_LIFETIME,
	REGION_LIFETIME_SCALING,
	REGION_MAX_LIFETIME,
	REGION_BASE_HP,
	REGION_HP_SCALING,
	REGION_BASE_RADIUS,
	REGION_RADIUS_SCALING,
	REGION_MAX_RADIUS,
	REGION_BASE_SPAWN_INTERVAL,
	REGION_SPAWN_INTERVAL_SCALING,
	REGION_MIN_SPAWN_INTERVAL,
	WAVE_REGION_SPAWN_INTERVAL,
	WAVE_MAX_CONCURRENT_REGIONS,
	WAVE_INTERMISSION,
} from "../config.ts";
import { makeId, createNextWave } from "../state.ts";

const MARGIN = 60;
const MAX_PLACEMENT_ATTEMPTS = 20;

function randomRegionPosition(): { x: number; y: number } {
	for (let i = 0; i < MAX_PLACEMENT_ATTEMPTS; i++) {
		const x = MARGIN + Math.random() * (WORLD_WIDTH - MARGIN * 2);
		const y = MARGIN + Math.random() * (GROUND_Y - MARGIN * 2);
		const dx = x - TARGET_X;
		const dy = y - TARGET_Y;
		if (dx * dx + dy * dy > REGION_SAFE_RADIUS * REGION_SAFE_RADIUS) {
			return { x, y };
		}
	}
	return { x: MARGIN, y: MARGIN };
}

function regionParamsForWave(waveNumber: number) {
	return {
		lifetime: Math.min(REGION_BASE_LIFETIME + waveNumber * REGION_LIFETIME_SCALING, REGION_MAX_LIFETIME),
		hp: REGION_BASE_HP + waveNumber * REGION_HP_SCALING,
		radius: Math.min(REGION_BASE_RADIUS + waveNumber * REGION_RADIUS_SCALING, REGION_MAX_RADIUS),
		spawnInterval: Math.max(
			REGION_BASE_SPAWN_INTERVAL - waveNumber * REGION_SPAWN_INTERVAL_SCALING,
			REGION_MIN_SPAWN_INTERVAL,
		),
	};
}

function createRegion(waveNumber: number): SpawnRegion {
	const position = randomRegionPosition();
	const params = regionParamsForWave(waveNumber);
	return {
		id: makeId(),
		position,
		radius: params.radius,
		hp: params.hp,
		maxHp: params.hp,
		spawnInterval: params.spawnInterval,
		spawnTimer: params.spawnInterval * 0.5,
		lifetime: params.lifetime,
		age: 0,
	};
}

export function tickWaves(state: GameState, delta: number): GameState {
	const wave = state.wave;

	if (wave.betweenWaves) {
		const remaining = wave.intermissionTimer - delta;
		if (remaining <= 0) return { ...state, wave: createNextWave(wave) };
		return { ...state, wave: { ...wave, intermissionTimer: remaining } };
	}

	if (wave.regionsToSpawn <= 0 && state.regions.length === 0 && state.enemies.length === 0) {
		return {
			...state,
			wave: { ...wave, betweenWaves: true, intermissionTimer: WAVE_INTERMISSION },
		};
	}

	if (wave.regionsToSpawn <= 0) return state;
	if (state.regions.length >= WAVE_MAX_CONCURRENT_REGIONS) return state;

	const timer = wave.regionSpawnTimer - delta;
	if (timer > 0) return { ...state, wave: { ...wave, regionSpawnTimer: timer } };

	const region = createRegion(wave.waveNumber);
	return {
		...state,
		wave: {
			...wave,
			regionsToSpawn: wave.regionsToSpawn - 1,
			regionSpawnTimer: WAVE_REGION_SPAWN_INTERVAL,
		},
		regions: [...state.regions, region],
	};
}
