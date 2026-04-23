import {
	AdditiveBlending,
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
} from 'three';
import {
	BEAM_COLOR,
	BEAM_RADIUS,
	BEAM_TURRET_RANGE,
	ENGINE_PLUME_LENGTH_IDLE,
	ENGINE_PLUME_OPACITY_IDLE,
	ENGINE_PLUME_WIDTH_MULT,
	MAIN_GUN_BEAM_RADIUS,
	MAIN_GUN_COLOR,
	MAIN_GUN_COOLDOWN_MS,
	MAIN_GUN_DAMAGE_PER_SEC,
	MAIN_GUN_DETECTION_RANGE,
	MAIN_GUN_DURATION_MS,
	MAIN_GUN_VISUAL_LENGTH,
	MUZZLE_OFFSET,
} from '../constants';
import type { Faction } from '../types';
import type { AuxiliaryKind, AuxiliaryMount, EmptyTurretMount, PairSlotDef, PairSlotId } from './loadout';
import type { BeamTurretMount, MissileTurretMount, ShipSpec, TurretMount } from './specs';

export interface EngineMount {
	readonly anchor: Object3D;
	readonly plume: Mesh;
	readonly plumeMat: MeshBasicMaterial;
	readonly size: number;
}

export interface ShipMaterials {
	readonly hull: MeshStandardMaterial;
	readonly accent: MeshStandardMaterial;
	readonly engine: MeshStandardMaterial;
}

export interface BeamMountBuild {
	readonly mount: Group;
	readonly beamMesh: Mesh;
}

export interface MainGunMountBuild {
	readonly slot: PairSlotId;
	readonly pylonA: number;
	readonly pylonB: number;
	readonly midX: number;
	readonly midZ: number;
	readonly facing: number;
	readonly group: Group;
	readonly beamMesh: Mesh;
}

const BARREL_LENGTH = 0.9;
const BARREL_RADIUS = 0.08;
const TURRET_BASE_RADIUS = 0.25;
const TURRET_BASE_HEIGHT = 0.25;

export const BARREL_MAT = new MeshStandardMaterial({ color: 0x111418, roughness: 0.45, metalness: 0.4 });
BARREL_MAT.userData.shared = true;

const TURRET_BASE_GEO = new CylinderGeometry(TURRET_BASE_RADIUS, TURRET_BASE_RADIUS, TURRET_BASE_HEIGHT, 10);
TURRET_BASE_GEO.userData.shared = true;

export const CARRIER_ACCENT_MAT = new MeshStandardMaterial({ color: 0x222833, roughness: 0.6, metalness: 0.2 });
CARRIER_ACCENT_MAT.userData.shared = true;

export function buildTurretMountGroup(
	mountSpec: TurretMount,
	hullHeight: number,
	accentMat: MeshStandardMaterial,
): Group {
	const turretGroup = new Group();
	turretGroup.position.set(mountSpec.x, hullHeight, mountSpec.z);
	turretGroup.rotation.y = mountSpec.baseAngle;

	const base = new Mesh(TURRET_BASE_GEO, accentMat);
	base.position.y = TURRET_BASE_HEIGHT / 2;
	turretGroup.add(base);

	const barrel = new Mesh(
		new CylinderGeometry(BARREL_RADIUS, BARREL_RADIUS, BARREL_LENGTH, 8),
		BARREL_MAT,
	);
	barrel.position.set(0, TURRET_BASE_HEIGHT + 0.02, BARREL_LENGTH / 2);
	barrel.rotation.x = Math.PI / 2;
	turretGroup.add(barrel);

	return turretGroup;
}

export function buildEmptyMountGroup(
	mountSpec: EmptyTurretMount,
	hullHeight: number,
	accentMat: MeshStandardMaterial,
): Group {
	const mount = new Group();
	mount.position.set(mountSpec.x, hullHeight, mountSpec.z);
	mount.rotation.y = mountSpec.baseAngle;

	const base = new Mesh(TURRET_BASE_GEO, accentMat);
	base.position.y = TURRET_BASE_HEIGHT / 2;
	mount.add(base);

	return mount;
}

const AUX_PLACEHOLDER_GEO = new BoxGeometry(0.06, 0.22, 0.9);
AUX_PLACEHOLDER_GEO.userData.shared = true;

export function buildAuxMountGroup(
	mountSpec: AuxiliaryMount,
	spec: ShipSpec,
	accentMat: MeshStandardMaterial,
): Group {
	const group = new Group();
	const sign = mountSpec.x >= 0 ? 1 : -1;
	group.position.set(sign * (spec.hullWidth / 2 + 0.02), spec.hullHeight * 0.55, mountSpec.z);
	const placeholder = new Mesh(AUX_PLACEHOLDER_GEO, accentMat);
	group.add(placeholder);
	return group;
}

const SHIELD_AUX_GEO = new BoxGeometry(0.12, 0.3, 0.5);
SHIELD_AUX_GEO.userData.shared = true;
const SHIELD_AUX_MAT = new MeshStandardMaterial({
	color: 0x3a9bff,
	emissive: 0x1a5fbf,
	emissiveIntensity: 0.8,
	roughness: 0.4,
	metalness: 0.3,
});
SHIELD_AUX_MAT.userData.shared = true;

export function buildAuxSystemVisual(kind: AuxiliaryKind): Mesh {
	if (kind === 'shield') return new Mesh(SHIELD_AUX_GEO, SHIELD_AUX_MAT);
	throw new Error(`Unhandled auxiliary kind: ${kind satisfies never}`);
}

const LAUNCHER_BODY_W = 0.5;
const LAUNCHER_BODY_H = 0.2;
const LAUNCHER_BODY_L = 0.7;
const LAUNCHER_TIP_W = 0.35;
const LAUNCHER_TIP_H = 0.16;
const LAUNCHER_TIP_L = 0.18;
const LAUNCHER_TIP_Z = 0.42;

export function buildMissileMountGroup(
	mountSpec: MissileTurretMount,
	hullHeight: number,
	accentMat: MeshStandardMaterial,
): Group {
	const launcherGroup = new Group();
	launcherGroup.position.set(mountSpec.x, hullHeight, mountSpec.z);
	launcherGroup.rotation.y = mountSpec.fireAngle;

	const body = new Mesh(
		new BoxGeometry(LAUNCHER_BODY_W, LAUNCHER_BODY_H, LAUNCHER_BODY_L),
		accentMat,
	);
	body.position.set(0, LAUNCHER_BODY_H / 2, 0);
	launcherGroup.add(body);

	const tip = new Mesh(
		new BoxGeometry(LAUNCHER_TIP_W, LAUNCHER_TIP_H, LAUNCHER_TIP_L),
		BARREL_MAT,
	);
	tip.position.set(0, LAUNCHER_BODY_H / 2, LAUNCHER_TIP_Z);
	launcherGroup.add(tip);

	return launcherGroup;
}

const BEAM_EMITTER_RADIUS = 0.18;
const BEAM_EMITTER_LENGTH = 0.55;

export function buildBeamMountGroup(
	mountSpec: BeamTurretMount,
	hullHeight: number,
	accentMat: MeshStandardMaterial,
): BeamMountBuild {
	const mount = new Group();
	mount.position.set(mountSpec.x, hullHeight, mountSpec.z);
	mount.rotation.y = mountSpec.baseAngle;

	const base = new Mesh(TURRET_BASE_GEO, accentMat);
	base.position.y = TURRET_BASE_HEIGHT / 2;
	mount.add(base);

	const emitter = new Mesh(
		new CylinderGeometry(BEAM_EMITTER_RADIUS, BEAM_EMITTER_RADIUS * 0.6, BEAM_EMITTER_LENGTH, 10),
		BARREL_MAT,
	);
	emitter.position.set(0, TURRET_BASE_HEIGHT + 0.02, BEAM_EMITTER_LENGTH / 2);
	emitter.rotation.x = Math.PI / 2;
	mount.add(emitter);

	const beamGeo = new CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, 1, 10);
	beamGeo.rotateX(Math.PI / 2);
	beamGeo.translate(0, 0, 0.5);
	const beamMat = new MeshStandardMaterial({
		color: BEAM_COLOR,
		emissive: BEAM_COLOR,
		emissiveIntensity: 1.4,
		transparent: true,
		opacity: 0.7,
	});
	const beamMesh = new Mesh(beamGeo, beamMat);
	beamMesh.position.set(0, TURRET_BASE_HEIGHT, MUZZLE_OFFSET);
	beamMesh.scale.z = mountSpec.range ?? BEAM_TURRET_RANGE;
	beamMesh.visible = false;
	mount.add(beamMesh);

	return { mount, beamMesh };
}

type Vec2Lite = { readonly x: number; readonly z: number };

export const pairMidpoint = (pa: { x: number; z: number }, pb: { x: number; z: number }): Vec2Lite => ({
	x: (pa.x + pb.x) / 2,
	z: (pa.z + pb.z) / 2,
});

export const pairDirection = (pa: { x: number; z: number }, pb: { x: number; z: number }): number => {
	const ldx = pb.x - pa.x;
	const ldz = pb.z - pa.z;
	const perpX = -ldz;
	const perpZ = ldx;
	const mid = pairMidpoint(pa, pb);
	const sign = perpX * mid.x + perpZ * mid.z >= 0 ? 1 : -1;
	return Math.atan2(perpX * sign, perpZ * sign);
};

const MAIN_GUN_EMITTER_WIDTH = 2.16;
const MAIN_GUN_EMITTER_HEIGHT = 0.45;
const MAIN_GUN_EMITTER_DEPTH = 0.9;

export const buildMainGunBeamGroup = (
	pairDef: PairSlotDef,
	mountA: EmptyTurretMount,
	mountB: EmptyTurretMount,
	hullHeight: number,
	accentMat: MeshStandardMaterial,
): MainGunMountBuild => {
	const mid = pairMidpoint(mountA, mountB);
	const facing = pairDirection(mountA, mountB);

	const group = new Group();
	group.position.set(mid.x, hullHeight, mid.z);
	group.rotation.y = facing;

	const emitter = new Mesh(
		new BoxGeometry(MAIN_GUN_EMITTER_WIDTH, MAIN_GUN_EMITTER_HEIGHT, MAIN_GUN_EMITTER_DEPTH),
		accentMat,
	);
	emitter.position.set(0, MAIN_GUN_EMITTER_HEIGHT / 2, MAIN_GUN_EMITTER_DEPTH / 2);
	group.add(emitter);

	const beamGeo = new CylinderGeometry(MAIN_GUN_BEAM_RADIUS, MAIN_GUN_BEAM_RADIUS, 1, 16);
	beamGeo.rotateX(Math.PI / 2);
	beamGeo.translate(0, 0, 0.5);
	const beamMat = new MeshStandardMaterial({
		color: MAIN_GUN_COLOR,
		emissive: MAIN_GUN_COLOR,
		emissiveIntensity: 1.6,
		transparent: true,
		opacity: 0.75,
	});
	const beamMesh = new Mesh(beamGeo, beamMat);
	beamMesh.position.set(0, MAIN_GUN_EMITTER_HEIGHT / 2, MAIN_GUN_EMITTER_DEPTH);
	beamMesh.scale.z = MAIN_GUN_VISUAL_LENGTH;
	beamMesh.visible = false;
	group.add(beamMesh);

	return {
		slot: pairDef.slot,
		pylonA: pairDef.pylonA,
		pylonB: pairDef.pylonB,
		midX: mid.x,
		midZ: mid.z,
		facing,
		group,
		beamMesh,
	};
};

export const mainGunBeamFromMount = (ownerId: number, faction: Faction, build: MainGunMountBuild) => ({
	mainGunBeam: {
		ownerId,
		faction,
		mountX: build.midX,
		mountZ: build.midZ,
		facing: build.facing,
		detectionRange: MAIN_GUN_DETECTION_RANGE,
		visualLength: MAIN_GUN_VISUAL_LENGTH,
		beamRadius: MAIN_GUN_BEAM_RADIUS,
		damagePerSecond: MAIN_GUN_DAMAGE_PER_SEC,
		beamDurationMs: MAIN_GUN_DURATION_MS,
		beamCooldownMs: MAIN_GUN_COOLDOWN_MS,
		state: 'idle' as const,
		stateTimerMs: 0,
		beamMesh: build.beamMesh,
	},
});

export function attachEnginePlume(
	engineMesh: Mesh,
	engineDepth: number,
	size: number,
	color: number,
	opacity: number = ENGINE_PLUME_OPACITY_IDLE,
	lengthFactor: number = ENGINE_PLUME_LENGTH_IDLE,
): EngineMount {
	const plumeMat = new MeshBasicMaterial({
		color,
		transparent: true,
		opacity,
		blending: AdditiveBlending,
		depthWrite: false,
	});
	const geo = new ConeGeometry(1, 1, 10);
	geo.rotateX(-Math.PI / 2);
	geo.translate(0, 0, -0.5);
	const plume = new Mesh(geo, plumeMat);
	plume.position.z = -engineDepth / 2;
	const width = size * ENGINE_PLUME_WIDTH_MULT;
	plume.scale.set(width, width, size * lengthFactor);
	engineMesh.add(plume);

	const anchor = new Object3D();
	anchor.position.z = -engineDepth / 2;
	engineMesh.add(anchor);

	return { anchor, plume, plumeMat, size };
}

export const engineSize = (width: number, height: number): number => Math.max(width, height) * 0.5;

export const createEngineMaterial = (color: number, emissive: number): MeshStandardMaterial =>
	new MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.4 });
