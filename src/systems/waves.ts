import type { SpawnRegion, GameState } from "../types.ts";
import {
	CANVAS_WIDTH,
	CANVAS_HEIGHT,
	GROUND_Y,
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

const SPAWN_MARGIN = 40;

function randomPerimeterPoint(): { x: number; y: number } {
	const edge = Math.floor(Math.random() * 3); // top, right, left — all above ground
	const along = Math.random();
	return [
		{ x: SPAWN_MARGIN + along * (CANVAS_WIDTH - SPAWN_MARGIN * 2), y: -SPAWN_MARGIN },
		{ x: CANVAS_WIDTH + SPAWN_MARGIN, y: SPAWN_MARGIN + along * (GROUND_Y - SPAWN_MARGIN * 2) },
		{ x: -SPAWN_MARGIN, y: SPAWN_MARGIN + along * (GROUND_Y - SPAWN_MARGIN * 2) },
	][edge] ?? { x: CANVAS_WIDTH + SPAWN_MARGIN, y: GROUND_Y / 2 };
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
	const position = randomPerimeterPoint();
	const params = regionParamsForWave(waveNumber);
	return {
		id: makeId(),
		position,
		radius: params.radius,
		hp: params.hp,
		maxHp: params.hp,
		spawnInterval: params.spawnInterval,
		spawnTimer: params.spawnInterval * 0.5, // slight delay before first spawn
		lifetime: params.lifetime,
		age: 0,
	};
}

export function tickWaves(
	state: GameState,
	delta: number,
): { state: GameState; spawnedRegions: ReadonlyArray<SpawnRegion> } {
	const wave = state.wave;

	if (wave.betweenWaves) {
		const remaining = wave.intermissionTimer - delta;
		if (remaining <= 0) {
			return { state: { ...state, wave: createNextWave(wave) }, spawnedRegions: [] };
		}
		return {
			state: { ...state, wave: { ...wave, intermissionTimer: remaining } },
			spawnedRegions: [],
		};
	}

	// Wave complete when all regions spawned, all regions gone, all enemies gone
	if (wave.regionsToSpawn <= 0 && state.regions.length === 0 && state.enemies.length === 0) {
		return {
			state: {
				...state,
				wave: { ...wave, betweenWaves: true, intermissionTimer: WAVE_INTERMISSION },
			},
			spawnedRegions: [],
		};
	}

	if (wave.regionsToSpawn <= 0) {
		return { state, spawnedRegions: [] };
	}

	// Respect max concurrent regions
	if (state.regions.length >= WAVE_MAX_CONCURRENT_REGIONS) {
		return { state, spawnedRegions: [] };
	}

	const timer = wave.regionSpawnTimer - delta;
	if (timer > 0) {
		return {
			state: { ...state, wave: { ...wave, regionSpawnTimer: timer } },
			spawnedRegions: [],
		};
	}

	const region = createRegion(wave.waveNumber);
	return {
		state: {
			...state,
			wave: {
				...wave,
				regionsToSpawn: wave.regionsToSpawn - 1,
				regionSpawnTimer: WAVE_REGION_SPAWN_INTERVAL,
			},
			regions: [...state.regions, region],
		},
		spawnedRegions: [region],
	};
}
