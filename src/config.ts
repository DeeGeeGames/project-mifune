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

export const BULLET_SPEED = 1200;
export const BULLET_DAMAGE = 1;
export const BULLET_RADIUS = 4;
export const BULLET_HIT_RADIUS = 16;

export const ENEMY_SPEED = 80;
export const ENEMY_HP = 4;
export const ENEMY_RADIUS = 12;

export const BASE_ENEMIES_PER_WAVE = 20;
export const ENEMIES_PER_WAVE_SCALING = 3;
export const BASE_SPAWN_INTERVAL = 400;
export const SPAWN_INTERVAL_DECAY = 0.92;
export const MIN_SPAWN_INTERVAL = 100;

export const TURRET_TURN_SPEED = Math.PI; // radians per second (180°/sec)
export const WAVE_INTERMISSION = 4000;

export const SPAWN_X = CANVAS_WIDTH + 40;

export const PLACEMENT_MIN_X = 80;
export const PLACEMENT_MAX_X = CANVAS_WIDTH - 80;

export const TURRET_SPREAD = 0.08;
