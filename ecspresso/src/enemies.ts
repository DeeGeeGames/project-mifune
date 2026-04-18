import {
	ENEMY_RADIUS,
	ENEMY_HULL_LENGTH,
	ENEMY_HULL_WIDTH,
	ENEMY_HULL_HEIGHT,
	GUNSHIP_THREAT_TOLERANCE,
	ORBIT_STRIKE_INTERVAL_SEC,
} from './constants';
import type { TurretMount } from './ships';

export type EnemyKind = 'pursuer' | 'interceptor' | 'flanker' | 'orbiter' | 'gunship';

export type PerceptionTier = 'positional' | 'kinematic' | 'predictive';

export type EnemyBehavior =
	| { readonly kind: 'pursuer' }
	| { readonly kind: 'interceptor' }
	| { readonly kind: 'flanker'; readonly side: -1 | 1 }
	| { kind: 'orbiter'; readonly dir: -1 | 1; strikeTimer: number; mode: 'orbit' | 'strike' }
	| { readonly kind: 'gunship'; readonly perceptionTier: PerceptionTier };

export interface EnemySpec {
	readonly hp: number;
	readonly color: number;
	readonly turnRate: number;
	readonly turnAccel: number;
	readonly accel: number;
	readonly maxSpeed: number;
	readonly drag: number;
	readonly hullLength: number;
	readonly hullWidth: number;
	readonly hullHeight: number;
	readonly radius: number;
	readonly turretMount?: TurretMount;
	readonly threatTolerance?: number;
}

export const ENEMY_KINDS = ['pursuer', 'interceptor', 'flanker', 'orbiter', 'gunship'] as const satisfies readonly EnemyKind[];

const KAMIKAZE_HULL = {
	hullLength: ENEMY_HULL_LENGTH,
	hullWidth: ENEMY_HULL_WIDTH,
	hullHeight: ENEMY_HULL_HEIGHT,
	radius: ENEMY_RADIUS,
} as const;

export const ENEMY_SPECS: Record<EnemyKind, EnemySpec> = {
	pursuer: {
		hp: 1,
		color: 0xcc3344,
		turnRate: 0.225,
		turnAccel: 0.3,
		accel: 0.6,
		maxSpeed: 3.5,
		drag: 0.3,
		...KAMIKAZE_HULL,
	},
	interceptor: {
		hp: 2,
		color: 0xcc33cc,
		turnRate: 0.3,
		turnAccel: 0.4,
		accel: 0.65,
		maxSpeed: 3.8,
		drag: 0.3,
		...KAMIKAZE_HULL,
	},
	flanker: {
		hp: 3,
		color: 0xaacc33,
		turnRate: 0.35,
		turnAccel: 0.45,
		accel: 0.675,
		maxSpeed: 4,
		drag: 0.3,
		...KAMIKAZE_HULL,
	},
	orbiter: {
		hp: 5,
		color: 0x33cccc,
		turnRate: 0.45,
		turnAccel: 0.5,
		accel: 0.7,
		maxSpeed: 4.2,
		drag: 0.3,
		...KAMIKAZE_HULL,
	},
	gunship: {
		hp: 50,
		color: 0xb04030,
		turnRate: 0.18,
		turnAccel: 0.18,
		accel: 0.4,
		maxSpeed: 2.5,
		drag: 0.3,
		hullLength: 5.5,
		hullWidth: 1.4,
		hullHeight: 0.5,
		radius: 1.4,
		turretMount: {
			x: 0,
			z: 0.6,
			baseAngle: 0,
			coneHalf: Math.PI / 3,
			range: 25,
			fireIntervalMs: 500,
			damage: 4,
		},
		threatTolerance: GUNSHIP_THREAT_TOLERANCE,
	},
};

const randomSide = (): -1 | 1 => (Math.random() < 0.5 ? -1 : 1);

const BEHAVIOR_FACTORIES: Record<EnemyKind, () => EnemyBehavior> = {
	pursuer: () => ({ kind: 'pursuer' }),
	interceptor: () => ({ kind: 'interceptor' }),
	flanker: () => ({ kind: 'flanker', side: randomSide() }),
	orbiter: () => ({
		kind: 'orbiter',
		dir: randomSide(),
		strikeTimer: ORBIT_STRIKE_INTERVAL_SEC * (0.5 + Math.random() * 0.5),
		mode: 'orbit',
	}),
	gunship: () => ({ kind: 'gunship', perceptionTier: 'positional' }),
};

export const makeBehavior = (kind: EnemyKind): EnemyBehavior => BEHAVIOR_FACTORIES[kind]();
