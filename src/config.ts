export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const GROUND_Y = 580;

export const TARGET_X = CANVAS_WIDTH / 2;
export const TARGET_Y = GROUND_Y;
export const TARGET_RADIUS = 20;
export const DEFENSE_HP = 10;

export const TURRET_RANGE = 300;
export const TURRET_FIRE_RATE = 6;
export const TURRET_RADIUS = 18;
export const TURRET_BARREL_LENGTH = 28;
export const TURRET_TURN_SPEED = Math.PI / 2; // radians per second

export const BULLET_SPEED = 1200;
export const BULLET_DAMAGE = 1;
export const BULLET_RADIUS = 4;
export const BULLET_HIT_RADIUS = 16;

export const ENEMY_SPEED = 80;
export const ENEMY_HP = 4;
export const ENEMY_RADIUS = 12;

// Spawn regions
export const REGION_BASE_LIFETIME = 6000;         // ms, wave 1
export const REGION_LIFETIME_SCALING = 1500;      // ms added per wave
export const REGION_MAX_LIFETIME = 24000;         // ms cap
export const REGION_BASE_HP = 8;
export const REGION_HP_SCALING = 4;               // hp added per wave
export const REGION_BASE_RADIUS = 40;
export const REGION_RADIUS_SCALING = 2;
export const REGION_MAX_RADIUS = 75;
export const REGION_BASE_SPAWN_INTERVAL = 900;    // ms between enemy spawns
export const REGION_SPAWN_INTERVAL_SCALING = 60;  // ms reduction per wave
export const REGION_MIN_SPAWN_INTERVAL = 180;
export const REGION_SPAWN_SPREAD = 20;            // px enemy offset from region center

// Waves
export const WAVE_REGIONS_BASE = 2;               // regions per wave (+ waveNumber)
export const WAVE_REGION_SPAWN_INTERVAL = 2500;   // ms between region spawns within a wave
export const WAVE_MAX_CONCURRENT_REGIONS = 4;
export const WAVE_INTERMISSION = 4000;

export const PLACEMENT_MIN_X = 80;
export const PLACEMENT_MAX_X = CANVAS_WIDTH - 80;

export const TURRET_SPREAD = 0.08;

// Economy
export const TURRET_COST = 50;
export const STARTING_CURRENCY = 100;
export const RESOURCE_DROP_VALUE = 15;

// Runners
export const RUNNER_SPEED = 120;
export const RUNNER_HP = 1;
export const RUNNER_RADIUS = 10;
export const RUNNER_COST = 30;
export const STARTING_RUNNERS = 2;
export const MAX_RUNNERS = 8;
export const RUNNER_PICKUP_DISTANCE = 15;
export const RUNNER_BASE_ARRIVE_DISTANCE = 25;
