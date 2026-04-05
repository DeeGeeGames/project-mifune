export const VIEWPORT_WIDTH = 1280;
export const VIEWPORT_HEIGHT = 720;

export const WORLD_WIDTH = VIEWPORT_WIDTH * 6;
export const WORLD_HEIGHT = VIEWPORT_HEIGHT * 6;

export const GROUND_Y = WORLD_HEIGHT - 140;

export const TARGET_X = WORLD_WIDTH / 2;
export const TARGET_Y = GROUND_Y;
export const TARGET_RADIUS = 40;
export const DEFENSE_HP = 10;

export const TURRET_RANGE = 1200;
export const TURRET_FIRE_RATE = 12;
export const TURRET_RADIUS = 18;
export const TURRET_BARREL_LENGTH = 28;
export const TURRET_TURN_SPEED = Math.PI / 2; // radians per second

export const BULLET_SPEED = 2400;
export const BULLET_DAMAGE = 1;
export const BULLET_RADIUS = 4;
export const BULLET_HIT_RADIUS = 16;

export const ENEMY_SPEED = 150;
export const ENEMY_HP = 4;
export const ENEMY_RADIUS = 12;
export const ENEMY_SPAWN_BURST_SPEED = 1000;
export const ENEMY_MOMENTUM_DECAY = 1;

// Spawn regions
export const REGION_BASE_LIFETIME = 2000;         // ms, wave 1
export const REGION_LIFETIME_SCALING = 1000;      // ms added per wave
export const REGION_MAX_LIFETIME = 24000;         // ms cap
export const REGION_BASE_HP = 32;
export const REGION_HP_SCALING = 8;               // hp added per wave
export const REGION_BASE_RADIUS = 80;
export const REGION_RADIUS_SCALING = 4;
export const REGION_MAX_RADIUS = 150;
export const REGION_BASE_SPAWN_INTERVAL = 200;    // ms between enemy spawns
export const REGION_SPAWN_INTERVAL_SCALING = 60;  // ms reduction per wave
export const REGION_MIN_SPAWN_INTERVAL = 80;
// Waves
export const WAVE_REGIONS_BASE = 1;               // regions per wave (+ waveNumber)
export const WAVE_REGION_SPAWN_INTERVAL = 2500;   // ms between region spawns within a wave
export const WAVE_MAX_CONCURRENT_REGIONS = 4;
export const WAVE_INTERMISSION = 4000;
export const STARTING_WAVE = 1;

export const REGION_SAFE_RADIUS = 400;

export const PLACEMENT_MIN_X = 80;
export const PLACEMENT_MAX_X = WORLD_WIDTH - 80;

export const TURRET_SPREAD = 0.08;

// Coverage arc
export const ARC_WIDTH_DEFAULT = Math.PI;           // 180 degrees
export const ARC_WIDTH_MIN = Math.PI / 6;           // 30 degrees
export const ARC_SCROLL_STEP = Math.PI / 18;        // 10 degrees per scroll tick
export const TURRET_HOVER_RADIUS = TURRET_RADIUS * 3;

// Per-turret valid arc range (ground turrets = upper semicircle)
export const ARC_RANGE_CENTER = -Math.PI / 2;       // up
export const ARC_RANGE_WIDTH = Math.PI;              // 180 degrees total valid zone
export const GROUND_ARC_RANGE = { center: ARC_RANGE_CENTER, width: ARC_RANGE_WIDTH } as const;

export const REGION_BURST_ARC_WIDTH = Math.PI / 4;          // 45° momentum cone per region
export const REGION_BURST_VALID_RANGE = { center: ARC_RANGE_CENTER, width: ARC_RANGE_WIDTH } as const;

// Blocks
export const BLOCK_SIZE = 36;
export const BLOCK_HP = 20;
export const BLOCK_COST = 10;
export const BLOCK_FACE_CLICK_THRESHOLD = 24;
export const RIGHT_FACE_ARC_RANGE = { center: 0, width: Math.PI } as const;
export const LEFT_FACE_ARC_RANGE = { center: Math.PI, width: Math.PI } as const;

// Economy
export const TURRET_COST = 50;
export const STARTING_CURRENCY = 200;
export const RESOURCE_DROP_VALUE = 10;

// Runners
export const RUNNER_SPEED = 120;
export const RUNNER_HP = 1;
export const RUNNER_SIZE = 10;
export const RUNNER_COST = 30;
export const STARTING_RUNNERS = 2;
export const MAX_RUNNERS = 20;
export const ENEMY_RUNNER_AGGRO_RANGE = 120;

export const RUNNER_PICKUP_DISTANCE = 15;
export const RUNNER_BASE_ARRIVE_DISTANCE = 25;

// Build menu (right-side panel)
export const MENU_PANEL_WIDTH = 140;
export const MENU_BUTTON_HEIGHT = 48;
export const MENU_BUTTON_GAP = 8;
export const MENU_PADDING = 8;
export const MENU_BUTTON_DEFS = [
	{ action: "turret" as const, label: "Turret", cost: TURRET_COST },
	{ action: "block" as const, label: "Block", cost: BLOCK_COST },
	{ action: "runner" as const, label: "Runner", cost: RUNNER_COST },
] as const;
export const MENU_PANEL_HEIGHT =
	MENU_BUTTON_DEFS.length * MENU_BUTTON_HEIGHT +
	(MENU_BUTTON_DEFS.length - 1) * MENU_BUTTON_GAP +
	MENU_PADDING * 2;

// Ammo
export const TURRET_MAX_AMMO = 1000;
export const TURRET_RELOAD_THRESHOLD = 500;
export const RUNNER_RELOAD_AMOUNT = 500;
