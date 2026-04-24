import {
	FRONT,
	PORT,
	STARBOARD,
	PORT_FORE,
	STARBOARD_FORE,
	PORT_AFT,
	STARBOARD_AFT,
} from './angles';
import type {
	AuxiliaryMount,
	CarrierLoadoutAux,
	CarrierLoadoutPair,
	EmptyTurretMount,
} from './loadout';
import { PAIR_SLOTS } from './loadout';

export type ShipClass = 'carrier' | 'corvette' | 'frigate' | 'destroyer' | 'dreadnought';

export interface TurretMount {
	readonly x: number;
	readonly z: number;
	readonly baseAngle: number;
	readonly coneHalf?: number;
	readonly range?: number;
	readonly fireIntervalMs?: number;
	readonly damage?: number;
	readonly splashDamage?: number;
	readonly splashRadius?: number;
	readonly burstCount?: number;
	readonly burstShotDelayMs?: number;
}

export interface BeamTurretMount {
	readonly x: number;
	readonly z: number;
	readonly baseAngle: number;
	readonly coneHalf?: number;
	readonly range?: number;
	readonly damagePerSecond?: number;
	readonly beamDurationMs?: number;
	readonly beamCooldownMs?: number;
}

export interface MissileTurretMount {
	readonly x: number;
	readonly z: number;
	readonly baseAngle: number;
	readonly fireAngle: number;
	readonly coneHalf?: number;
	readonly range?: number;
	readonly fireIntervalMs?: number;
	readonly damage?: number;
	readonly burstCount?: number;
	readonly burstShotDelayMs?: number;
}

export interface ShipSpec {
	readonly hullLength: number;
	readonly hullWidth: number;
	readonly hullHeight: number;
	readonly colliderLength?: number;
	readonly colliderWidth?: number;
	readonly color: number;
	readonly turnRate: number;
	readonly turnAccel: number;
	readonly accel: number;
	readonly maxSpeed: number;
	readonly drag: number;
	readonly hp: number;
	readonly cost: number;
	readonly turrets: readonly TurretMount[];
	readonly cannonTurrets?: readonly TurretMount[];
	readonly beamTurrets?: readonly BeamTurretMount[];
	readonly missileTurrets?: readonly MissileTurretMount[];
	readonly emptyTurretMounts?: readonly EmptyTurretMount[];
	readonly auxiliaryMounts?: readonly AuxiliaryMount[];
	readonly flatBow?: true;
}

export const SHIP_SPECS: Record<ShipClass, ShipSpec> = {
	carrier: {
		hullLength: 11.0,
		hullWidth: 2.4,
		hullHeight: 0.8,
		color: 0x8a94a6,
		turnRate: 0.32,
		turnAccel: 0.2,
		accel: 2,
		maxSpeed: 14.4,
		drag: 0.3,
		hp: 1000,
		cost: 0,
		turrets: [],
		emptyTurretMounts: [
			{ x: 1.0, z: 3.0, baseAngle: STARBOARD_FORE, category: 'forward' },
			{ x: 1.0, z: 0, baseAngle: STARBOARD, category: 'side' },
			{ x: 1.0, z: -3.0, baseAngle: STARBOARD_AFT, category: 'back' },
			{ x: -1.0, z: 3.0, baseAngle: PORT_FORE, category: 'forward' },
			{ x: -1.0, z: 0, baseAngle: PORT, category: 'side' },
			{ x: -1.0, z: -3.0, baseAngle: PORT_AFT, category: 'back' },
		],
		auxiliaryMounts: [
			{ x: 1.0, z: 2.2 }, { x: 1.0, z: -0.8 }, { x: 1.0, z: -3.8 },
			{ x: -1.0, z: 2.2 }, { x: -1.0, z: -0.8 }, { x: -1.0, z: -3.8 },
		],
		flatBow: true,
	},
	corvette: {
		hullLength: 6.2,
		hullWidth: 1.45,
		hullHeight: 0.45,
		colliderLength: 8.1,
		color: 0x33ccee,
		turnRate: 1.2,
		turnAccel: 1.6,
		accel: 3,
		maxSpeed: 16,
		drag: 0.3,
		hp: 100,
		cost: 0,
		turrets: [
			{ x: -0.57, z: -1.83, baseAngle: PORT_FORE, coneHalf: Math.PI / 4, fireIntervalMs: 1000 / 3, damage: 2 },
			{ x: 0.57, z: -1.83, baseAngle: STARBOARD_FORE, coneHalf: Math.PI / 4, fireIntervalMs: 1000 / 3, damage: 2 },
		],
	},
	frigate: {
		hullLength: 6.8,
		hullWidth: 1.55,
		hullHeight: 0.5,
		colliderLength: 8.8,
		color: 0x55cc55,
		turnRate: 0.9,
		turnAccel: 1,
		accel: 2.5,
		maxSpeed: 14,
		drag: 0.3,
		hp: 200,
		cost: 100,
		turrets: [
			{ x: -0.78, z: 0.24, baseAngle: PORT },
			{ x: 0.78, z: 0.24, baseAngle: STARBOARD },
		],
	},
	destroyer: {
		hullLength: 7.4,
		hullWidth: 1.65,
		hullHeight: 0.55,
		colliderLength: 9.6,
		color: 0xff9933,
		turnRate: 0.7,
		turnAccel: 0.6,
		accel: 2,
		maxSpeed: 12,
		drag: 0.3,
		hp: 350,
		cost: 250,
		turrets: [
			{ x: 0, z: 2.61, baseAngle: FRONT },
			{ x: -0.83, z: -0.65, baseAngle: PORT },
			{ x: 0.83, z: -0.65, baseAngle: STARBOARD },
		],
	},
	dreadnought: {
		hullLength: 8.4,
		hullWidth: 1.8,
		hullHeight: 0.7,
		colliderLength: 10.9,
		color: 0xdd3344,
		turnRate: 0.5,
		turnAccel: 0.4,
		accel: 1.5,
		maxSpeed: 10,
		drag: 0.3,
		hp: 600,
		cost: 500,
		turrets: [
			{ x: 0, z: 3.25, baseAngle: FRONT },
			{ x: -0.90, z: 0.76, baseAngle: PORT },
			{ x: 0.90, z: 0.76, baseAngle: STARBOARD },
			{ x: -0.90, z: -1.53, baseAngle: PORT },
			{ x: 0.90, z: -1.53, baseAngle: STARBOARD },
		],
	},
};

export const emptyLoadoutPairs = (): CarrierLoadoutPair[] =>
	PAIR_SLOTS.map((p) => ({ ...p, weaponKind: null }));

export const emptyLoadoutAuxSlots = (spec: ShipSpec): CarrierLoadoutAux[] =>
	(spec.auxiliaryMounts ?? []).map(() => ({ systemKind: null }));
