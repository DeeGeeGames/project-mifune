import type { WeaponKind } from './ships';
import { WEAPON_LABELS } from './loadoutLabels';
import { degreesRounded } from './math';
import {
	BULLET_DAMAGE,
	TURRET_FIRE_INTERVAL_MS,
	TURRET_RANGE,
	TURRET_CONE_HALF,
	TURRET_BURST_COUNT,
	CANNON_DAMAGE,
	CANNON_SPLASH_DAMAGE,
	CANNON_SPLASH_RADIUS,
	CANNON_TURRET_FIRE_INTERVAL_MS,
	CANNON_TURRET_RANGE,
	CANNON_TURRET_CONE_HALF,
	BEAM_TURRET_DAMAGE_PER_SEC,
	BEAM_TURRET_DURATION_MS,
	BEAM_TURRET_COOLDOWN_MS,
	BEAM_TURRET_RANGE,
	BEAM_TURRET_CONE_HALF,
	MISSILE_DAMAGE,
	MISSILE_TURRET_FIRE_INTERVAL_MS,
	MISSILE_TURRET_RANGE,
	MISSILE_TURRET_CONE_HALF,
	MISSILE_TURRET_BURST_COUNT,
	RAILGUN_DAMAGE,
	RAILGUN_TURRET_FIRE_INTERVAL_MS,
	RAILGUN_TURRET_RANGE,
	RAILGUN_TURRET_CONE_HALF,
	RAILGUN_MAX_PIERCE,
	PD_DAMAGE,
	PD_TURRET_FIRE_INTERVAL_MS,
	PD_TURRET_RANGE,
	PD_TURRET_CONE_HALF,
	WEAPON_COSTS,
} from './constants';

export interface WeaponStatRow {
	readonly label: string;
	readonly value: string;
}

const arcText = (coneHalf: number): string => `${degreesRounded(coneHalf * 2)}° cone`;

const rangeText = (units: number): string => `${units}`;

const rpsText = (fireIntervalMs: number, burst: number = 1): string => {
	const rps = (1000 / fireIntervalMs) * burst;
	const rounded = rps >= 10 ? Math.round(rps) : Math.round(rps * 10) / 10;
	return burst > 1 ? `${rounded}/s (burst ${burst})` : `${rounded}/s`;
};

const beamFireText = (): string => {
	const duration = BEAM_TURRET_DURATION_MS / 1000;
	const cooldown = BEAM_TURRET_COOLDOWN_MS / 1000;
	return `${duration}s beam · ${cooldown}s cd`;
};

const cost = (kind: WeaponKind): string => `${WEAPON_COSTS[kind]} res`;

const WEAPON_STATS: Record<WeaponKind, readonly WeaponStatRow[]> = {
	turret: [
		{ label: 'Damage',    value: `${BULLET_DAMAGE}` },
		{ label: 'Fire Rate', value: rpsText(TURRET_FIRE_INTERVAL_MS, TURRET_BURST_COUNT) },
		{ label: 'Range',     value: rangeText(TURRET_RANGE) },
		{ label: 'Arc',       value: arcText(TURRET_CONE_HALF) },
		{ label: 'Cost',      value: cost('turret') },
	],
	cannon: [
		{ label: 'Damage',    value: `${CANNON_DAMAGE} (+${CANNON_SPLASH_DAMAGE} splash r${CANNON_SPLASH_RADIUS})` },
		{ label: 'Fire Rate', value: rpsText(CANNON_TURRET_FIRE_INTERVAL_MS) },
		{ label: 'Range',     value: rangeText(CANNON_TURRET_RANGE) },
		{ label: 'Arc',       value: arcText(CANNON_TURRET_CONE_HALF) },
		{ label: 'Cost',      value: cost('cannon') },
	],
	beam: [
		{ label: 'Damage',    value: `${BEAM_TURRET_DAMAGE_PER_SEC} dps` },
		{ label: 'Fire Rate', value: beamFireText() },
		{ label: 'Range',     value: rangeText(BEAM_TURRET_RANGE) },
		{ label: 'Arc',       value: arcText(BEAM_TURRET_CONE_HALF) },
		{ label: 'Cost',      value: cost('beam') },
	],
	missile: [
		{ label: 'Damage',    value: `${MISSILE_DAMAGE}` },
		{ label: 'Fire Rate', value: rpsText(MISSILE_TURRET_FIRE_INTERVAL_MS, MISSILE_TURRET_BURST_COUNT) },
		{ label: 'Range',     value: rangeText(MISSILE_TURRET_RANGE) },
		{ label: 'Arc',       value: arcText(MISSILE_TURRET_CONE_HALF) },
		{ label: 'Cost',      value: cost('missile') },
	],
	railgun: [
		{ label: 'Damage',    value: `${RAILGUN_DAMAGE} (pierce ${RAILGUN_MAX_PIERCE})` },
		{ label: 'Fire Rate', value: rpsText(RAILGUN_TURRET_FIRE_INTERVAL_MS) },
		{ label: 'Range',     value: rangeText(RAILGUN_TURRET_RANGE) },
		{ label: 'Arc',       value: arcText(RAILGUN_TURRET_CONE_HALF) },
		{ label: 'Cost',      value: cost('railgun') },
	],
	pd: [
		{ label: 'Damage',    value: `${PD_DAMAGE}` },
		{ label: 'Fire Rate', value: rpsText(PD_TURRET_FIRE_INTERVAL_MS) },
		{ label: 'Range',     value: rangeText(PD_TURRET_RANGE) },
		{ label: 'Arc',       value: arcText(PD_TURRET_CONE_HALF) },
		{ label: 'Cost',      value: cost('pd') },
	],
};

export const weaponStats = (kind: WeaponKind | null): readonly WeaponStatRow[] =>
	kind === null ? [] : WEAPON_STATS[kind];

export const weaponDisplayName = (kind: WeaponKind | null): string =>
	WEAPON_LABELS[kind ?? 'none'];
