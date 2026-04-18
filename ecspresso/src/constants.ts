export const ISO_AZIMUTH = Math.PI / 4;
export const ISO_ELEVATION = Math.atan(1 / Math.SQRT2);

export const CAMERA_VIEW_SIZE = 20;
export const CAMERA_ZOOM_MIN = 0.25;
export const CAMERA_ZOOM_MAX = 2.5;
export const CAMERA_ZOOM_STEP = 1.1;
export const CAMERA_FOLLOW_SMOOTHING = 6;
export const CAMERA_DISTANCE = 60;

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
export const TURRET_RANGE = 40;
export const MUZZLE_OFFSET = 0.9;

export const BULLET_SPEED = 30;
export const BULLET_LIFE_SEC = 1.5;
export const BULLET_DAMAGE = 1;

export const MISSILE_SPEED = 18;
export const MISSILE_LAUNCH_SPEED = 4.5;
export const MISSILE_LIFE_SEC = 3;
export const MISSILE_UNGUIDED_SEC = 0.5;
export const MISSILE_TURN_RATE = Math.PI;
export const MISSILE_DAMAGE = 4;
export const MISSILE_RADIUS = 0.3;
export const MISSILE_TURRET_FIRE_INTERVAL_MS = 2000;
export const MISSILE_TURRET_CONE_HALF = Math.PI / 4;
export const MISSILE_TURRET_RANGE = 40;

export const ENEMY_RADIUS = 0.6;
export const ENEMY_SPAWN_RING_PAD = 8;
export const SHIP_HIT_RADIUS = 1.2;

export const ENEMY_HULL_LENGTH = 1.3;
export const ENEMY_HULL_WIDTH = 0.25;
export const ENEMY_HULL_HEIGHT = 0.3;

export const FLANK_OFFSET = 4;
export const ORBIT_RADIUS = 12;
export const ORBIT_BAND = 1.5;
export const ORBIT_STRIKE_INTERVAL_SEC = 4;
export const ORBIT_STRIKE_DURATION_SEC = 1.2;

export const GUNSHIP_PREFERRED_RANGE = 20;
export const GUNSHIP_RANGE_TOLERANCE = 2;
export const GUNSHIP_HOLD_THROTTLE = 0.15;
export const GUNSHIP_THREAT_TOLERANCE = 8;
export const GUNSHIP_EVADE_MAX_OFFSET = Math.PI / 7;
export const GUNSHIP_EVADE_THROTTLE = 0.6;

export const HIT_ESCALATION_DECAY_RATE = 1.0;

export const ENEMY_SPAWN_WEIGHTS = {
	pursuer: 25,
	interceptor: 22,
	flanker: 20,
	orbiter: 18,
	gunship: 15,
} as const;

export const PROJECTILE_RADIUS = 0.25;

export const PICKUP_VALUE = 10;
export const PICKUP_MAGNET_RADIUS = 6;
export const PICKUP_MAGNET_SPEED = 14;
export const PICKUP_COLLECT_RADIUS = 1;

export const FORMATION_SPACING = 6;
export const FORMATION_SLOWING_RADIUS = FORMATION_SPACING * 1.5;
export const FORMATION_CONTROL_TAU = 0.2;

export const WAVE_START_INTERVAL_MS = 1500;
export const WAVE_MIN_INTERVAL_MS = 400;
export const WAVE_RAMP_SEC = 180;

export const SUMMON_ANIM_SEC = 1.0;
export const SUMMON_OFFSCREEN_RING = 35;

export const GROUND_SIZE = 400;

export const AIM_ARC_RADIUS = 12;
export const AIM_ARC_SEGMENTS = 24;
export const AIM_ARC_Y_OFFSET = 0.05;
export const AIM_ARC_FILL_Y_OFFSET = 0.04;
export const AIM_ARC_COLOR = 0x7fd1ff;
export const AIM_ARC_DASH_SIZE = 0.25;
export const AIM_ARC_GAP_SIZE = 0.15;
export const AIM_ARC_FILL_OPACITY = 0.18;
