import type { Group, Mesh } from 'three';
import {
	BEAM_TURRET_CONE_HALF,
	BEAM_TURRET_COOLDOWN_MS,
	BEAM_TURRET_DAMAGE_PER_SEC,
	BEAM_TURRET_DURATION_MS,
	BEAM_TURRET_RANGE,
	BULLET_DAMAGE,
	CANNON_DAMAGE,
	CANNON_SHELL_LIFE_SEC,
	CANNON_SHELL_SPEED,
	CANNON_SPLASH_DAMAGE,
	CANNON_SPLASH_RADIUS,
	CANNON_TURRET_BURST_COUNT,
	CANNON_TURRET_BURST_SHOT_DELAY_MS,
	CANNON_TURRET_CONE_HALF,
	CANNON_TURRET_FIRE_INTERVAL_MS,
	CANNON_TURRET_RANGE,
	MISSILE_DAMAGE,
	MISSILE_TURRET_BURST_COUNT,
	MISSILE_TURRET_BURST_SHOT_DELAY_MS,
	MISSILE_TURRET_CONE_HALF,
	MISSILE_TURRET_FIRE_INTERVAL_MS,
	MISSILE_TURRET_RANGE,
	PD_DAMAGE,
	PD_SHELL_LIFE_SEC,
	PD_SHELL_SPEED,
	PD_SPREAD_HALF,
	PD_TURRET_BURST_COUNT,
	PD_TURRET_BURST_SHOT_DELAY_MS,
	PD_TURRET_CONE_HALF,
	PD_TURRET_FIRE_INTERVAL_MS,
	PD_TURRET_RANGE,
	RAILGUN_DAMAGE,
	RAILGUN_MAX_PIERCE,
	RAILGUN_SHELL_LIFE_SEC,
	RAILGUN_SHELL_SPEED,
	RAILGUN_TURRET_BURST_COUNT,
	RAILGUN_TURRET_BURST_SHOT_DELAY_MS,
	RAILGUN_TURRET_CONE_HALF,
	RAILGUN_TURRET_FIRE_INTERVAL_MS,
	RAILGUN_TURRET_RANGE,
	TURRET_BURST_COUNT,
	TURRET_BURST_SHOT_DELAY_MS,
	TURRET_CONE_HALF,
	TURRET_FIRE_INTERVAL_MS,
	TURRET_RANGE,
} from '../constants';
import type { Faction, World } from '../types';
import { createBurstFireState } from '../weapons';
import type {
	CarrierLoadout,
	CarrierLoadoutPair,
	CarrierLoadoutPylon,
	EmptyTurretMount,
} from './loadout';
import { pylonsConsumedByPairs } from './loadout';
import type { BeamTurretMount, MissileTurretMount, ShipSpec, TurretMount } from './specs';
import {
	buildBeamMountGroup,
	buildMainGunBeamGroup,
	buildMissileMountGroup,
	buildTurretMountGroup,
	buildAuxSystemVisual,
	CARRIER_ACCENT_MAT,
	mainGunBeamFromMount,
	type MainGunMountBuild,
} from './mounts';
import type { BuiltShip } from './ship';

export function turretFromMount(ownerId: number, faction: Faction, mountSpec: TurretMount, mount: Group) {
	return {
		turret: {
			ownerId,
			faction,
			mountX: mountSpec.x,
			mountZ: mountSpec.z,
			baseAngle: mountSpec.baseAngle,
			aimAngle: mountSpec.baseAngle,
			coneHalf: mountSpec.coneHalf ?? TURRET_CONE_HALF,
			range: mountSpec.range ?? TURRET_RANGE,
			damage: mountSpec.damage ?? BULLET_DAMAGE,
			hasTarget: false,
			mount,
		},
		burstFire: createBurstFireState({
			fireIntervalMs: mountSpec.fireIntervalMs ?? TURRET_FIRE_INTERVAL_MS,
			burstCount: mountSpec.burstCount ?? TURRET_BURST_COUNT,
			burstShotDelayMs: mountSpec.burstShotDelayMs ?? TURRET_BURST_SHOT_DELAY_MS,
		}),
	};
}

export function beamTurretFromMount(
	ownerId: number,
	faction: Faction,
	mountSpec: BeamTurretMount,
	mount: Group,
	beamMesh: Mesh,
) {
	return {
		beamTurret: {
			ownerId,
			faction,
			mountX: mountSpec.x,
			mountZ: mountSpec.z,
			baseAngle: mountSpec.baseAngle,
			aimAngle: mountSpec.baseAngle,
			coneHalf: mountSpec.coneHalf ?? BEAM_TURRET_CONE_HALF,
			range: mountSpec.range ?? BEAM_TURRET_RANGE,
			damagePerSecond: mountSpec.damagePerSecond ?? BEAM_TURRET_DAMAGE_PER_SEC,
			beamDurationMs: mountSpec.beamDurationMs ?? BEAM_TURRET_DURATION_MS,
			beamCooldownMs: mountSpec.beamCooldownMs ?? BEAM_TURRET_COOLDOWN_MS,
			state: 'idle' as const,
			stateTimerMs: 0,
			targetId: null,
			hasTarget: false,
			mount,
			beamMesh,
		},
	};
}

export function missileTurretFromMount(ownerShipId: number, mountSpec: MissileTurretMount, mount: Group) {
	return {
		missileTurret: {
			ownerShipId,
			mountX: mountSpec.x,
			mountZ: mountSpec.z,
			baseAngle: mountSpec.baseAngle,
			fireAngle: mountSpec.fireAngle,
			coneHalf: mountSpec.coneHalf ?? MISSILE_TURRET_CONE_HALF,
			range: mountSpec.range ?? MISSILE_TURRET_RANGE,
			damage: mountSpec.damage ?? MISSILE_DAMAGE,
			mount,
		},
		burstFire: createBurstFireState({
			fireIntervalMs: mountSpec.fireIntervalMs ?? MISSILE_TURRET_FIRE_INTERVAL_MS,
			burstCount: mountSpec.burstCount ?? MISSILE_TURRET_BURST_COUNT,
			burstShotDelayMs: mountSpec.burstShotDelayMs ?? MISSILE_TURRET_BURST_SHOT_DELAY_MS,
		}),
	};
}

export function cannonTurretFromMount(ownerId: number, faction: Faction, mountSpec: TurretMount, mount: Group) {
	return {
		turret: {
			ownerId,
			faction,
			mountX: mountSpec.x,
			mountZ: mountSpec.z,
			baseAngle: mountSpec.baseAngle,
			aimAngle: mountSpec.baseAngle,
			coneHalf: mountSpec.coneHalf ?? CANNON_TURRET_CONE_HALF,
			range: mountSpec.range ?? CANNON_TURRET_RANGE,
			damage: mountSpec.damage ?? CANNON_DAMAGE,
			splashDamage: mountSpec.splashDamage ?? CANNON_SPLASH_DAMAGE,
			splashRadius: mountSpec.splashRadius ?? CANNON_SPLASH_RADIUS,
			projectileKind: 'cannon' as const,
			projectileSpeed: CANNON_SHELL_SPEED,
			projectileLife: CANNON_SHELL_LIFE_SEC,
			hasTarget: false,
			mount,
		},
		burstFire: createBurstFireState({
			fireIntervalMs: mountSpec.fireIntervalMs ?? CANNON_TURRET_FIRE_INTERVAL_MS,
			burstCount: mountSpec.burstCount ?? CANNON_TURRET_BURST_COUNT,
			burstShotDelayMs: mountSpec.burstShotDelayMs ?? CANNON_TURRET_BURST_SHOT_DELAY_MS,
		}),
	};
}

export function railgunTurretFromMount(ownerId: number, faction: Faction, mountSpec: TurretMount, mount: Group) {
	return {
		turret: {
			ownerId,
			faction,
			mountX: mountSpec.x,
			mountZ: mountSpec.z,
			baseAngle: mountSpec.baseAngle,
			aimAngle: mountSpec.baseAngle,
			coneHalf: mountSpec.coneHalf ?? RAILGUN_TURRET_CONE_HALF,
			range: mountSpec.range ?? RAILGUN_TURRET_RANGE,
			damage: mountSpec.damage ?? RAILGUN_DAMAGE,
			projectileKind: 'railgun' as const,
			projectileSpeed: RAILGUN_SHELL_SPEED,
			projectileLife: RAILGUN_SHELL_LIFE_SEC,
			pierce: RAILGUN_MAX_PIERCE,
			hasTarget: false,
			mount,
		},
		burstFire: createBurstFireState({
			fireIntervalMs: mountSpec.fireIntervalMs ?? RAILGUN_TURRET_FIRE_INTERVAL_MS,
			burstCount: mountSpec.burstCount ?? RAILGUN_TURRET_BURST_COUNT,
			burstShotDelayMs: mountSpec.burstShotDelayMs ?? RAILGUN_TURRET_BURST_SHOT_DELAY_MS,
		}),
	};
}

export function pdTurretFromMount(ownerId: number, faction: Faction, mountSpec: TurretMount, mount: Group) {
	return {
		turret: {
			ownerId,
			faction,
			mountX: mountSpec.x,
			mountZ: mountSpec.z,
			baseAngle: mountSpec.baseAngle,
			aimAngle: mountSpec.baseAngle,
			coneHalf: mountSpec.coneHalf ?? PD_TURRET_CONE_HALF,
			range: mountSpec.range ?? PD_TURRET_RANGE,
			damage: mountSpec.damage ?? PD_DAMAGE,
			projectileKind: 'pd' as const,
			projectileSpeed: PD_SHELL_SPEED,
			projectileLife: PD_SHELL_LIFE_SEC,
			spreadHalf: PD_SPREAD_HALF,
			hasTarget: false,
			mount,
		},
		burstFire: createBurstFireState({
			fireIntervalMs: mountSpec.fireIntervalMs ?? PD_TURRET_FIRE_INTERVAL_MS,
			burstCount: mountSpec.burstCount ?? PD_TURRET_BURST_COUNT,
			burstShotDelayMs: mountSpec.burstShotDelayMs ?? PD_TURRET_BURST_SHOT_DELAY_MS,
		}),
	};
}

export function spawnShipTurrets(ecs: World, ownerId: number, spec: ShipSpec, built: BuiltShip): number[] {
	const opts = { scope: 'playing' } as const;
	const ids: number[] = [];
	spec.turrets.forEach((mountSpec, idx) => {
		const mount = built.turretMounts[idx];
		if (!mount) return;
		ids.push(ecs.spawn({ ...turretFromMount(ownerId, 'ally', mountSpec, mount) }, opts).id);
	});
	(spec.cannonTurrets ?? []).forEach((mountSpec, idx) => {
		const mount = built.cannonTurretMounts[idx];
		if (!mount) return;
		ids.push(ecs.spawn({ ...cannonTurretFromMount(ownerId, 'ally', mountSpec, mount) }, opts).id);
	});
	(spec.beamTurrets ?? []).forEach((mountSpec, idx) => {
		const beamMount = built.beamTurretMounts[idx];
		if (!beamMount) return;
		ids.push(ecs.spawn({ ...beamTurretFromMount(ownerId, 'ally', mountSpec, beamMount.mount, beamMount.beamMesh) }, opts).id);
	});
	(spec.missileTurrets ?? []).forEach((mountSpec, idx) => {
		const mount = built.missileTurretMounts[idx];
		if (!mount) return;
		ids.push(ecs.spawn({ ...missileTurretFromMount(ownerId, mountSpec, mount) }, opts).id);
	});
	return ids;
}

type MaterializedMount =
	| { kind: 'turret' | 'cannon' | 'railgun' | 'pd'; mount: Group; mountSpec: TurretMount }
	| { kind: 'beam'; mount: Group; beamMesh: Mesh; mountSpec: BeamTurretMount }
	| { kind: 'missile'; mount: Group; mountSpec: MissileTurretMount };

const materializeLoadoutMount = (
	spec: ShipSpec,
	built: BuiltShip,
	emptyMount: EmptyTurretMount,
	idx: number,
	pylon: CarrierLoadoutPylon,
): MaterializedMount | null => {
	if (pylon.weaponKind === null) return null;
	if (pylon.weaponKind === 'mainGun') return null;
	const placeholder = built.emptyTurretMountGroups[idx];
	if (placeholder) built.group.remove(placeholder);
	const mountSpec = { x: emptyMount.x, z: emptyMount.z, baseAngle: pylon.facing };
	if (pylon.weaponKind === 'beam') {
		const beamBuild = buildBeamMountGroup(mountSpec, spec.hullHeight, CARRIER_ACCENT_MAT);
		built.group.add(beamBuild.mount);
		return { kind: 'beam', mount: beamBuild.mount, beamMesh: beamBuild.beamMesh, mountSpec };
	}
	if (pylon.weaponKind === 'missile') {
		const missileSpec: MissileTurretMount = { ...mountSpec, fireAngle: pylon.facing };
		const mount = buildMissileMountGroup(missileSpec, spec.hullHeight, CARRIER_ACCENT_MAT);
		built.group.add(mount);
		return { kind: 'missile', mount, mountSpec: missileSpec };
	}
	const mount = buildTurretMountGroup(mountSpec, spec.hullHeight, CARRIER_ACCENT_MAT);
	built.group.add(mount);
	return { kind: pylon.weaponKind, mount, mountSpec };
};

const materializeMainGunPair = (
	spec: ShipSpec,
	built: BuiltShip,
	emptyMounts: readonly EmptyTurretMount[],
	pair: CarrierLoadoutPair,
): MainGunMountBuild | null => {
	const mountA = emptyMounts[pair.pylonA];
	const mountB = emptyMounts[pair.pylonB];
	if (!mountA || !mountB) return null;
	[pair.pylonA, pair.pylonB].forEach((idx) => {
		const placeholder = built.emptyTurretMountGroups[idx];
		if (placeholder) placeholder.visible = false;
	});
	const build = buildMainGunBeamGroup(
		{ slot: pair.slot, pylonA: pair.pylonA, pylonB: pair.pylonB },
		mountA,
		mountB,
		spec.hullHeight,
		CARRIER_ACCENT_MAT,
	);
	built.group.add(build.group);
	return build;
};

export function buildCarrierLoadoutVisual(
	spec: ShipSpec,
	built: BuiltShip,
	loadout: CarrierLoadout,
): void {
	const emptyMounts = spec.emptyTurretMounts ?? [];
	const consumed = pylonsConsumedByPairs(loadout);
	loadout.pairs.forEach((pair) => {
		if (pair.weaponKind === 'mainGun') materializeMainGunPair(spec, built, emptyMounts, pair);
	});
	emptyMounts.forEach((emptyMount, idx) => {
		if (consumed.has(idx)) return;
		const pylon = loadout.pylons[idx];
		if (pylon) materializeLoadoutMount(spec, built, emptyMount, idx, pylon);
	});
	loadout.auxSlots.forEach((aux, idx) => {
		const auxGroup = built.emptyAuxMountGroups[idx];
		if (!auxGroup) return;
		if (aux.systemKind === null) return;
		auxGroup.clear();
		auxGroup.add(buildAuxSystemVisual(aux.systemKind));
	});
}

const loadoutComponentsFor = (ownerId: number, result: MaterializedMount) => {
	if (result.kind === 'beam') return beamTurretFromMount(ownerId, 'ally', result.mountSpec, result.mount, result.beamMesh);
	if (result.kind === 'cannon') return cannonTurretFromMount(ownerId, 'ally', result.mountSpec, result.mount);
	if (result.kind === 'missile') return missileTurretFromMount(ownerId, result.mountSpec, result.mount);
	if (result.kind === 'railgun') return railgunTurretFromMount(ownerId, 'ally', result.mountSpec, result.mount);
	if (result.kind === 'pd') return pdTurretFromMount(ownerId, 'ally', result.mountSpec, result.mount);
	return turretFromMount(ownerId, 'ally', result.mountSpec, result.mount);
};

export function applyCarrierLoadout(
	ecs: World,
	ownerId: number,
	spec: ShipSpec,
	built: BuiltShip,
	loadout: CarrierLoadout,
): void {
	const opts = { scope: 'playing' } as const;
	const emptyMounts = spec.emptyTurretMounts ?? [];
	const consumed = pylonsConsumedByPairs(loadout);
	loadout.pairs.forEach((pair) => {
		if (pair.weaponKind !== 'mainGun') return;
		const build = materializeMainGunPair(spec, built, emptyMounts, pair);
		if (!build) return;
		ecs.spawn({ ...mainGunBeamFromMount(ownerId, 'ally', build) }, opts);
	});
	emptyMounts.forEach((emptyMount, idx) => {
		if (consumed.has(idx)) return;
		const pylon = loadout.pylons[idx];
		if (!pylon) return;
		const result = materializeLoadoutMount(spec, built, emptyMount, idx, pylon);
		if (!result) return;
		ecs.spawn({ ...loadoutComponentsFor(ownerId, result) }, opts);
	});
}
