import type { EntityId, GameState, Runner, WaveState } from "./types.ts";
import {
	DEFENSE_HP,
	STARTING_CURRENCY,
	STARTING_RUNNERS,
	RUNNER_SPEED,
	RUNNER_HP,
	TARGET_X,
	TARGET_Y,
	WAVE_REGIONS_BASE,
	STARTING_WAVE,
} from "./config.ts";

let nextId = 0;

export function makeId(): EntityId {
	nextId += 1;
	return `e${nextId}`;
}

function regionsForWave(waveNumber: number): number {
	return WAVE_REGIONS_BASE + waveNumber;
}

export function createInitialWave(): WaveState {
	return {
		waveNumber: STARTING_WAVE,
		regionsToSpawn: regionsForWave(STARTING_WAVE),
		regionSpawnTimer: 0,
		betweenWaves: false,
		intermissionTimer: 0,
	};
}

export function createNextWave(current: WaveState): WaveState {
	const next = current.waveNumber + 1;
	return {
		waveNumber: next,
		regionsToSpawn: regionsForWave(next),
		regionSpawnTimer: 0,
		betweenWaves: false,
		intermissionTimer: 0,
	};
}

export function createRunner(): Runner {
	return {
		id: makeId(),
		position: { x: TARGET_X, y: TARGET_Y },
		speed: RUNNER_SPEED,
		hp: RUNNER_HP,
		state: { tag: "idle" },
	};
}

function createInitialRunners(): ReadonlyArray<Runner> {
	return Array.from({ length: STARTING_RUNNERS }, () => createRunner());
}

export function createInitialState(): GameState {
	return {
		turrets: [],
		enemies: [],
		bullets: [],
		regions: [],
		resources: [],
		runners: createInitialRunners(),
		controlMode: { tag: "none" },
		wave: createInitialWave(),
		defenseHp: DEFENSE_HP,
		currency: STARTING_CURRENCY,
		runnerPriority: "resources",
		gameOver: false,
	};
}
