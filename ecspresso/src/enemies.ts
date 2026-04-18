import { ORBIT_STRIKE_INTERVAL_SEC } from './constants';

export type EnemyKind = 'pursuer' | 'interceptor' | 'flanker' | 'orbiter';

export type EnemyBehavior =
	| { readonly kind: 'pursuer' }
	| { readonly kind: 'interceptor' }
	| { readonly kind: 'flanker'; readonly side: -1 | 1 }
	| { kind: 'orbiter'; readonly dir: -1 | 1; strikeTimer: number; mode: 'orbit' | 'strike' };

export interface EnemySpec {
	readonly hp: number;
	readonly color: number;
	readonly turnRate: number;
	readonly turnAccel: number;
	readonly accel: number;
	readonly maxSpeed: number;
	readonly drag: number;
}

export const ENEMY_KINDS = ['pursuer', 'interceptor', 'flanker', 'orbiter'] as const satisfies readonly EnemyKind[];

export const ENEMY_SPECS: Record<EnemyKind, EnemySpec> = {
	pursuer: {
		hp: 1,
		color: 0xcc3344,
		turnRate: 0.225,
		turnAccel: 0.3,
		accel: 0.6,
		maxSpeed: 3.5,
		drag: 0.3,
	},
	interceptor: {
		hp: 2,
		color: 0xcc33cc,
		turnRate: 0.3,
		turnAccel: 0.4,
		accel: 0.65,
		maxSpeed: 3.8,
		drag: 0.3,
	},
	flanker: {
		hp: 3,
		color: 0xaacc33,
		turnRate: 0.35,
		turnAccel: 0.45,
		accel: 0.675,
		maxSpeed: 4,
		drag: 0.3,
	},
	orbiter: {
		hp: 5,
		color: 0x33cccc,
		turnRate: 0.45,
		turnAccel: 0.5,
		accel: 0.7,
		maxSpeed: 4.2,
		drag: 0.3,
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
};

export const makeBehavior = (kind: EnemyKind): EnemyBehavior => BEHAVIOR_FACTORIES[kind]();
