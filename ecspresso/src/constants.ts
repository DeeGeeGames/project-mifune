export const ISO_AZIMUTH = Math.PI / 4;
export const ISO_ELEVATION = Math.atan(1 / Math.SQRT2);

export const CAMERA_VIEW_SIZE = 20;
export const CAMERA_ZOOM_MIN = 0.125;
export const CAMERA_ZOOM_MAX = 2.5;
export const CAMERA_ZOOM_STEP = 1.1;
export const CAMERA_FOLLOW_SMOOTHING = 6;
export const CAMERA_DISTANCE = 60;

export const LOADOUT_CARRIER_ROTATION_SMOOTHING = 6;

// Camera lead: pans the follow offset ahead of the carrier based on heading + velocity.
// direction = heading_unit + velocity / maxSpeed (sum; cancels under full reverse)
// baseMag = min(|sum|, 2) * CAMERA_LEAD_BASE_PER_SUM
//   -> stationary ≈ 3, full forward ≈ 6 (~quarter of view size when zoom=1)
// target magnitude creeps from base toward CAMERA_LEAD_MAX while lead stays aligned,
// bleeding off proportional to misalignment when direction changes.
export const CAMERA_LEAD_BASE_PER_SUM = 3;
export const CAMERA_LEAD_MAX = 9;
export const CAMERA_LEAD_CHARGE_RATE = 0.25;
export const CAMERA_LEAD_DECAY_RATE = 2.5;
export const CAMERA_LEAD_SMOOTHING = 4;
export const CAMERA_LEAD_ALIGN_THRESHOLD = 0.5;

export const TRIGGER_DEADZONE = 0.05;
export const STICK_ACTIVE_THRESHOLD = 0.25;

export const GP_BUTTON_A = 0;
export const GP_BUTTON_B = 1;
export const GP_BUTTON_X = 2;
export const GP_BUTTON_Y = 3;
export const GP_BUTTON_LB = 4;
export const GP_BUTTON_RB = 5;
export const GP_BUTTON_LT = 6;
export const GP_BUTTON_RT = 7;
export const GP_BUTTON_BACK = 8;
export const GP_BUTTON_START = 9;
export const GP_BUTTON_DPAD_UP = 12;
export const GP_BUTTON_DPAD_DOWN = 13;
export const GP_BUTTON_DPAD_LEFT = 14;
export const GP_BUTTON_DPAD_RIGHT = 15;

export const GP_AXIS_LS_X = 0;
export const GP_AXIS_LS_Y = 1;
export const GP_AXIS_RS_X = 2;
export const GP_AXIS_RS_Y = 3;

export const SHIP_DRAG = 0.6;
export const THRUST_RATE = 1.0;

export const TURRET_CONE_HALF = Math.PI / 6;
export const TURRET_TURN_RATE = Math.PI / 2;
export const TURRET_FIRE_INTERVAL_MS = 1000 / 12;
export const TURRET_RANGE = 80;
export const TURRET_BURST_COUNT = 1;
export const TURRET_BURST_SHOT_DELAY_MS = 0;
export const MUZZLE_OFFSET = 0.9;

export const CONE_APPROACH_RANGE_MULTIPLIER = 1.5;
export const CONE_APPROACH_ANGLE_MULTIPLIER = 1.3;

export const BULLET_SPEED = 30;
export const BULLET_LIFE_SEC = 1.5;
export const BULLET_DAMAGE = 1;

export const MISSILE_SPEED = 72;
export const MISSILE_LAUNCH_SPEED = 4.5;
export const MISSILE_LIFE_SEC = 3;
export const MISSILE_UNGUIDED_SEC = 0.5;
export const MISSILE_TURN_RATE = Math.PI;
export const MISSILE_DAMAGE = 4;
export const MISSILE_RADIUS = 0.3;
export const MISSILE_TURRET_FIRE_INTERVAL_MS = 2000;
export const MISSILE_TURRET_CONE_HALF = Math.PI / 4;
export const MISSILE_TURRET_RANGE = 160;
export const MISSILE_TURRET_BURST_COUNT = 3;
export const MISSILE_TURRET_BURST_SHOT_DELAY_MS = 120;

export const CANNON_TURRET_CONE_HALF = Math.PI / 3;
export const CANNON_TURRET_RANGE = 120;
export const CANNON_TURRET_FIRE_INTERVAL_MS = 4000;
export const CANNON_TURRET_BURST_COUNT = 1;
export const CANNON_TURRET_BURST_SHOT_DELAY_MS = 0;
export const CANNON_DAMAGE = 5;
export const CANNON_SPLASH_RADIUS = 15;
export const CANNON_SPLASH_DAMAGE = 2;
export const CANNON_SHELL_SPEED = 144;
export const CANNON_SHELL_LIFE_SEC = 3;
export const BLAST_LIFE_SEC = 0.25;

export const BEAM_TURRET_CONE_HALF = Math.PI / 6;
export const BEAM_TURRET_RANGE = 140;
export const BEAM_TURRET_DAMAGE_PER_SEC = 8;
export const BEAM_TURRET_DURATION_MS = 1000;
export const BEAM_TURRET_COOLDOWN_MS = 3000;
export const BEAM_RADIUS = 0.12;
export const BEAM_COLOR = 0x55eeff;

export const RAILGUN_TURRET_CONE_HALF = Math.PI / 12;
export const RAILGUN_TURRET_RANGE = 200;
export const RAILGUN_TURRET_FIRE_INTERVAL_MS = 5000;
export const RAILGUN_TURRET_BURST_COUNT = 1;
export const RAILGUN_TURRET_BURST_SHOT_DELAY_MS = 0;
export const RAILGUN_DAMAGE = 15;
export const RAILGUN_SHELL_SPEED = 600;
export const RAILGUN_SHELL_LIFE_SEC = 0.75;
export const RAILGUN_MAX_PIERCE = 5;

export const PD_TURRET_CONE_HALF = Math.PI / 2.5;
export const PD_TURRET_RANGE = 25;
export const PD_TURRET_FIRE_INTERVAL_MS = 50;
export const PD_TURRET_BURST_COUNT = 1;
export const PD_TURRET_BURST_SHOT_DELAY_MS = 0;
export const PD_DAMAGE = 0.5;
export const PD_SHELL_SPEED = 50;
export const PD_SHELL_LIFE_SEC = 0.6;
export const PD_SPREAD_HALF = Math.PI / 24;

export const MAIN_GUN_DETECTION_RANGE = RAILGUN_TURRET_RANGE;
export const MAIN_GUN_VISUAL_LENGTH = 1000;
export const MAIN_GUN_DAMAGE_PER_SEC = 240;
export const MAIN_GUN_DURATION_MS = 2000;
export const MAIN_GUN_COOLDOWN_MS = 8000;
export const MAIN_GUN_BEAM_RADIUS = 2;
export const MAIN_GUN_COLOR = 0xffaa33;

export const ENEMY_RADIUS = 0.6;
export const ENEMY_SPAWN_RING_PAD = 8;
export const ENEMY_SPAWN_DISTANCE_SCALE = 0.5;
export const SHIP_HIT_RADIUS = 1.2;

export const ENEMY_HULL_LENGTH = 1.3;
export const ENEMY_HULL_WIDTH = 0.25;
export const ENEMY_HULL_HEIGHT = 0.3;

export const FLANK_OFFSET = 4;
export const ORBIT_RADIUS = 12;
export const ORBIT_BAND = 1.5;
export const ORBIT_STRIKE_INTERVAL_SEC = 4;
export const ORBIT_STRIKE_DURATION_SEC = 1.2;

export interface RangedBehaviorConfig {
	readonly preferredRange: number;
	readonly rangeTolerance: number;
	readonly holdThrottle: number;
	readonly evadeMaxOffset: number;
	readonly evadeThrottle: number;
	readonly coneThreatWeight: number;
}

export const GUNSHIP_RANGED_CONFIG: RangedBehaviorConfig = {
	preferredRange: 20,
	rangeTolerance: 2,
	holdThrottle: 0.15,
	evadeMaxOffset: Math.PI / 7,
	evadeThrottle: 0.6,
	coneThreatWeight: 0.5,
};

export const BRAWLER_RANGED_CONFIG: RangedBehaviorConfig = {
	preferredRange: 8,
	rangeTolerance: 2,
	holdThrottle: 0.5,
	evadeMaxOffset: Math.PI / 10,
	evadeThrottle: 0.7,
	coneThreatWeight: 0.1,
};

export const SNIPER_RANGED_CONFIG: RangedBehaviorConfig = {
	preferredRange: 32,
	rangeTolerance: 3,
	holdThrottle: 0,
	evadeMaxOffset: Math.PI / 5,
	evadeThrottle: 1,
	coneThreatWeight: 1.5,
};

export const GUNSHIP_THREAT_TOLERANCE = 8;
export const BRAWLER_THREAT_TOLERANCE = 30;
export const SNIPER_THREAT_TOLERANCE = 3;

export interface SniperAimConfig {
	readonly angleThreshold: number;
	readonly throttleThreshold: number;
}

export const SNIPER_AIM_CONFIG: SniperAimConfig = {
	angleThreshold: Math.PI / 3,
	throttleThreshold: 0.3,
};

export const HIT_ESCALATION_DECAY_RATE = 1.0;

export const ENEMY_SPAWN_WEIGHTS = {
	pursuer: 25,
	interceptor: 22,
	flanker: 20,
	orbiter: 18,
	gunship: 10,
	brawler: 8,
	sniper: 5,
} as const;

export const PROJECTILE_RADIUS = 0.25;

export const PICKUP_VALUE = 10;
export const PICKUP_MAGNET_RADIUS = 6;
export const PICKUP_MAGNET_SPEED = 14;
export const PICKUP_COLLECT_RADIUS = 1;

export const WEAPON_COSTS = {
	turret:  50,
	pd:      90,
	cannon:  120,
	missile: 140,
	beam:    170,
	railgun: 200,
	mainGun: 400,
} as const;

export const MARKET_OFFER_COUNT = 4;
export const REROLL_BASE_COST = 10;
export const REROLL_PER_WAVE = 2;
export const REROLL_PER_REROLL = 5;

export const FORMATION_SPACING = 12;
export const FORMATION_ROW_SPACING = FORMATION_SPACING * 2;
export const FORMATION_SLOWING_RADIUS = FORMATION_SPACING * 1.5;
export const FORMATION_CONTROL_TAU = 0.2;
export const FORMATION_LOOKAHEAD_SEC = 0.4;
export const FORMATION_SEPARATION_RADIUS = 3;
export const FORMATION_SEPARATION_STRENGTH = 4;

export const WAVE_BASE_DURATION_SEC = 60;
export const WAVE_DURATION_GROWTH_SEC = 5;
export const WAVE_MAX_DURATION_SEC = 180;
export const WAVE_BASE_SPAWN_INTERVAL_MS = 1500;
export const WAVE_MIN_SPAWN_INTERVAL_MS = 400;
export const WAVE_SPAWN_INTERVAL_DECAY = 0.9;

// +Z world direction = directly in front of player
export const ENEMY_SPAWN_ANGLE_CENTER = 0;
export const ENEMY_SPAWN_ANGLE_SPREAD = Math.PI / 2;

export const SUMMON_ANIM_SEC = 1.0;
export const SUMMON_OFFSCREEN_RING = 35;

export const GROUND_SIZE = 1600;
export const GROUND_COLOR = 0x04060d;

export const STAR_COUNT = 2500;
export const STAR_FIELD_RADIUS = 400;
export const STAR_FIELD_Y_MIN = 20;
export const STAR_FIELD_Y_MAX = 80;
export const STAR_SIZE = 2;
export const STAR_BRIGHTNESS_MIN = 0.35;
export const STAR_BRIGHTNESS_RANGE = 0.65;

export const AIM_ARC_RADIUS = 12;
export const AIM_ARC_SEGMENTS = 24;
export const AIM_ARC_Y_OFFSET = 0.05;
export const AIM_ARC_FILL_Y_OFFSET = 0.04;
export const AIM_ARC_COLOR = 0x7fd1ff;
export const AIM_ARC_DASH_SIZE = 0.25;
export const AIM_ARC_GAP_SIZE = 0.15;
export const AIM_ARC_FILL_OPACITY = 0.18;

export const HEALTH_BAR_Y_OFFSET = 1.0;
export const HEALTH_BAR_HEIGHT = 0.15;
export const HEALTH_BAR_WIDTH_SCALE = 1.2;
export const HEALTH_BAR_BG_COLOR = 0x222222;
export const HEALTH_BAR_COLOR_FULL = 0x33cc33;
export const HEALTH_BAR_COLOR_MID = 0xccaa33;
export const HEALTH_BAR_COLOR_LOW = 0xcc3333;
