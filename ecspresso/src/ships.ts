import {
	Group,
	Mesh,
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	RingGeometry,
	MeshBasicMaterial,
	MeshStandardMaterial,
	DoubleSide,
} from 'three';
import {
	ENEMY_HULL_LENGTH,
	ENEMY_HULL_WIDTH,
	ENEMY_HULL_HEIGHT,
	TURRET_CONE_HALF,
	TURRET_FIRE_INTERVAL_MS,
	TURRET_RANGE,
	TURRET_BURST_COUNT,
	TURRET_BURST_SHOT_DELAY_MS,
	BULLET_DAMAGE,
	CANNON_TURRET_CONE_HALF,
	CANNON_TURRET_FIRE_INTERVAL_MS,
	CANNON_TURRET_RANGE,
	CANNON_TURRET_BURST_COUNT,
	CANNON_TURRET_BURST_SHOT_DELAY_MS,
	CANNON_DAMAGE,
	CANNON_SPLASH_DAMAGE,
	CANNON_SPLASH_RADIUS,
	CANNON_SHELL_SPEED,
	CANNON_SHELL_LIFE_SEC,
	MISSILE_TURRET_CONE_HALF,
	MISSILE_TURRET_FIRE_INTERVAL_MS,
	MISSILE_TURRET_RANGE,
	MISSILE_TURRET_BURST_COUNT,
	MISSILE_TURRET_BURST_SHOT_DELAY_MS,
	MISSILE_DAMAGE,
	BEAM_TURRET_CONE_HALF,
	BEAM_TURRET_RANGE,
	BEAM_TURRET_DAMAGE_PER_SEC,
	BEAM_TURRET_DURATION_MS,
	BEAM_TURRET_COOLDOWN_MS,
	BEAM_RADIUS,
	BEAM_COLOR,
	RAILGUN_TURRET_CONE_HALF,
	RAILGUN_TURRET_FIRE_INTERVAL_MS,
	RAILGUN_TURRET_RANGE,
	RAILGUN_TURRET_BURST_COUNT,
	RAILGUN_TURRET_BURST_SHOT_DELAY_MS,
	RAILGUN_DAMAGE,
	RAILGUN_SHELL_SPEED,
	RAILGUN_SHELL_LIFE_SEC,
	RAILGUN_MAX_PIERCE,
	PD_TURRET_CONE_HALF,
	PD_TURRET_FIRE_INTERVAL_MS,
	PD_TURRET_RANGE,
	PD_TURRET_BURST_COUNT,
	PD_TURRET_BURST_SHOT_DELAY_MS,
	PD_DAMAGE,
	PD_SHELL_SPEED,
	PD_SHELL_LIFE_SEC,
	PD_SPREAD_HALF,
	MUZZLE_OFFSET,
} from './constants';
import type { Faction, World } from './types';
import { ENEMY_SPECS, type EnemyKind } from './enemies';
import { createBurstFireState } from './weapons';

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

const FRONT = 0;
const PORT = -Math.PI / 2;
const STARBOARD = Math.PI / 2;
const PORT_FORE = -Math.PI / 4;
const STARBOARD_FORE = Math.PI / 4;
const PORT_AFT = -3 * Math.PI / 4;
const STARBOARD_AFT = 3 * Math.PI / 4;

export type PylonCategory = 'forward' | 'side' | 'back';

export type EmptyTurretMount = Pick<TurretMount, 'x' | 'z' | 'baseAngle'> & {
	readonly category: PylonCategory;
};

export type WeaponKind = 'turret' | 'cannon' | 'beam' | 'missile' | 'railgun' | 'pd';

export interface CarrierLoadoutPylon {
	weaponKind: WeaponKind | null;
	facing: number;
}

export interface CarrierLoadout {
	pylons: CarrierLoadoutPylon[];
}

const PYLON_ARC_RANGES = {
	forward: [FRONT, STARBOARD_AFT],
	side: [STARBOARD_FORE, STARBOARD_AFT],
	back: [STARBOARD_FORE, Math.PI],
} as const;

export function pylonArc(mount: EmptyTurretMount): { readonly min: number; readonly max: number } {
	const [lo, hi] = PYLON_ARC_RANGES[mount.category];
	return mount.x >= 0 ? { min: lo, max: hi } : { min: -hi, max: -lo };
}

export interface ShipSpec {
	readonly hullLength: number;
	readonly hullWidth: number;
	readonly hullHeight: number;
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
		flatBow: true,
	},
	corvette: {
		hullLength: 6.2,
		hullWidth: 1.45,
		hullHeight: 0.45,
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

const BARREL_LENGTH = 0.9;
const BARREL_RADIUS = 0.08;
const TURRET_BASE_RADIUS = 0.25;
const TURRET_BASE_HEIGHT = 0.25;

const BARREL_MAT = new MeshStandardMaterial({ color: 0x111418, roughness: 0.45, metalness: 0.4 });
const TURRET_BASE_GEO = new CylinderGeometry(TURRET_BASE_RADIUS, TURRET_BASE_RADIUS, TURRET_BASE_HEIGHT, 10);
BARREL_MAT.userData.shared = true;
TURRET_BASE_GEO.userData.shared = true;

function buildTurretMountGroup(
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

function buildEmptyMountGroup(
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

const LAUNCHER_BODY_W = 0.5;
const LAUNCHER_BODY_H = 0.2;
const LAUNCHER_BODY_L = 0.7;
const LAUNCHER_TIP_W = 0.35;
const LAUNCHER_TIP_H = 0.16;
const LAUNCHER_TIP_L = 0.18;
const LAUNCHER_TIP_Z = 0.42;

function buildMissileMountGroup(
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

function buildBeamMountGroup(
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

export interface BeamMountBuild {
	readonly mount: Group;
	readonly beamMesh: Mesh;
}

export interface BuiltShip {
	readonly group: Group;
	readonly turretMounts: readonly Group[];
	readonly cannonTurretMounts: readonly Group[];
	readonly beamTurretMounts: readonly BeamMountBuild[];
	readonly missileTurretMounts: readonly Group[];
	readonly emptyTurretMountGroups: readonly Group[];
}

interface ShipMaterials {
	readonly hull: MeshStandardMaterial;
	readonly accent: MeshStandardMaterial;
	readonly engine: MeshStandardMaterial;
}

type ShipDetailBuilder = (group: Group, spec: ShipSpec, mats: ShipMaterials) => void;

const SIDES = [-1, 1] as const;

const addCorvetteDetails: ShipDetailBuilder = (group, spec, mats) => {
	SIDES.forEach((side) => {
		const fin = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.55, spec.hullHeight * 0.22, spec.hullLength * 0.4),
			mats.accent,
		);
		fin.position.set(side * spec.hullWidth * 0.6, spec.hullHeight * 0.35, -spec.hullLength * 0.18);
		fin.rotation.y = side * 0.32;
		group.add(fin);
	});
	const cockpit = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.45, spec.hullHeight * 0.45, spec.hullLength * 0.3),
		mats.accent,
	);
	cockpit.position.set(0, spec.hullHeight + spec.hullHeight * 0.22, spec.hullLength * 0.05);
	group.add(cockpit);
	const eng = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.55, spec.hullHeight * 0.5, 0.12),
		mats.engine,
	);
	eng.position.set(0, spec.hullHeight * 0.5, -spec.hullLength / 2 - 0.06);
	group.add(eng);
};

const addFrigateDetails: ShipDetailBuilder = (group, spec, mats) => {
	SIDES.forEach((side) => {
		const sponson = new Mesh(
			new BoxGeometry(0.45, spec.hullHeight * 0.75, spec.hullLength * 0.4),
			mats.hull,
		);
		sponson.position.set(side * (spec.hullWidth / 2 + 0.18), spec.hullHeight * 0.55, 0.05);
		group.add(sponson);
	});
	const bridge = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.5, spec.hullHeight * 0.55, spec.hullLength * 0.3),
		mats.accent,
	);
	bridge.position.set(0, spec.hullHeight + spec.hullHeight * 0.27, -spec.hullLength * 0.18);
	group.add(bridge);
	const mast = new Mesh(
		new BoxGeometry(0.12, spec.hullHeight * 0.7, 0.12),
		mats.accent,
	);
	mast.position.set(0, spec.hullHeight + spec.hullHeight * 0.9, -spec.hullLength * 0.18);
	group.add(mast);
	SIDES.forEach((side) => {
		const eng = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.3, spec.hullHeight * 0.55, 0.14),
			mats.engine,
		);
		eng.position.set(side * spec.hullWidth * 0.27, spec.hullHeight * 0.45, -spec.hullLength / 2 - 0.07);
		group.add(eng);
	});
};

const addDestroyerDetails: ShipDetailBuilder = (group, spec, mats) => {
	const armor = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.85, spec.hullHeight * 0.4, spec.hullLength * 0.35),
		mats.hull,
	);
	armor.position.set(0, spec.hullHeight + spec.hullHeight * 0.2, spec.hullLength * 0.2);
	group.add(armor);
	const bridge = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.55, spec.hullHeight * 0.6, spec.hullLength * 0.32),
		mats.accent,
	);
	bridge.position.set(0, spec.hullHeight + spec.hullHeight * 0.55, -spec.hullLength * 0.18);
	group.add(bridge);
	const command = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.32, spec.hullHeight * 0.45, spec.hullLength * 0.2),
		mats.accent,
	);
	command.position.set(0, spec.hullHeight + spec.hullHeight * 1.075, -spec.hullLength * 0.18);
	group.add(command);
	SIDES.forEach((side) => {
		const eng = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.36, spec.hullHeight * 0.7, 0.18),
			mats.engine,
		);
		eng.position.set(side * spec.hullWidth * 0.27, spec.hullHeight * 0.5, -spec.hullLength / 2 - 0.09);
		group.add(eng);
	});
};

// Silhouette references the SDF-1 (Robotech) in cruiser/ship form: flanking engine
// pods running parallel to the main hull, tall central bridge tower, and forward
// antimatter cannon pylons flanking the bow.
const addDreadnoughtDetails: ShipDetailBuilder = (group, spec, mats) => {
	const podWidth = 0.5;
	const podHeight = spec.hullHeight;
	const podLength = spec.hullLength * 0.78;
	const podZ = -spec.hullLength * 0.12;
	SIDES.forEach((side) => {
		const pod = new Mesh(
			new BoxGeometry(podWidth, podHeight, podLength),
			mats.hull,
		);
		pod.position.set(side * (spec.hullWidth / 2 + podWidth / 2), podHeight / 2, podZ);
		group.add(pod);
		const podStripe = new Mesh(
			new BoxGeometry(podWidth * 0.7, 0.06, podLength * 0.85),
			mats.accent,
		);
		podStripe.position.set(side * (spec.hullWidth / 2 + podWidth / 2), podHeight + 0.01, podZ);
		group.add(podStripe);
		const eng = new Mesh(
			new BoxGeometry(podWidth * 0.75, podHeight * 0.7, 0.18),
			mats.engine,
		);
		eng.position.set(
			side * (spec.hullWidth / 2 + podWidth / 2),
			podHeight / 2,
			podZ - podLength / 2 - 0.09,
		);
		group.add(eng);
	});

	const towerBase = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.42, spec.hullHeight * 0.85, spec.hullLength * 0.3),
		mats.accent,
	);
	towerBase.position.set(0, spec.hullHeight + spec.hullHeight * 0.425, -spec.hullLength * 0.05);
	group.add(towerBase);
	const towerCommand = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.24, spec.hullHeight * 0.55, spec.hullLength * 0.18),
		mats.accent,
	);
	towerCommand.position.set(0, spec.hullHeight + spec.hullHeight * 1.125, -spec.hullLength * 0.05);
	group.add(towerCommand);
	const mast = new Mesh(
		new BoxGeometry(0.14, spec.hullHeight * 0.6, 0.14),
		mats.accent,
	);
	mast.position.set(0, spec.hullHeight + spec.hullHeight * 1.7, -spec.hullLength * 0.05);
	group.add(mast);

	SIDES.forEach((side) => {
		const pylon = new Mesh(
			new BoxGeometry(0.22, spec.hullHeight * 0.55, spec.hullLength * 0.45),
			mats.accent,
		);
		pylon.position.set(side * spec.hullWidth * 0.32, spec.hullHeight + spec.hullHeight * 0.05, spec.hullLength * 0.55);
		group.add(pylon);
	});

	const prow = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.7, spec.hullHeight * 0.35, spec.hullLength * 0.3),
		mats.hull,
	);
	prow.position.set(0, spec.hullHeight + spec.hullHeight * 0.175, spec.hullLength * 0.32);
	group.add(prow);
};

// Slab-hulled space carrier: ships launch from internal hangar bays, so no
// open flight deck — just a centered command tower atop a long armored hull.
// Intentionally undefended — carriers rely on their escort wing for firepower.
const addCarrierDetails: ShipDetailBuilder = (group, spec, mats) => {
	const towerMat = new MeshStandardMaterial({ color: 0x565e6c, roughness: 0.55, metalness: 0.25 });
	const towerZ = -spec.hullLength * 0.15;
	const towerBase = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.35, spec.hullHeight * 0.9, spec.hullLength * 0.18),
		towerMat,
	);
	towerBase.position.set(0, spec.hullHeight + spec.hullHeight * 0.45, towerZ);
	group.add(towerBase);

	const bridge = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.26, spec.hullHeight * 0.55, spec.hullLength * 0.11),
		towerMat,
	);
	bridge.position.set(0, spec.hullHeight + spec.hullHeight * 1.17, towerZ + spec.hullLength * 0.02);
	group.add(bridge);

	const mast = new Mesh(
		new BoxGeometry(0.1, spec.hullHeight * 0.8, 0.1),
		towerMat,
	);
	mast.position.set(0, spec.hullHeight + spec.hullHeight * 1.85, towerZ);
	group.add(mast);

	SIDES.forEach((side) => {
		const hangarStripe = new Mesh(
			new BoxGeometry(0.04, spec.hullHeight * 0.45, spec.hullLength * 0.6),
			mats.accent,
		);
		hangarStripe.position.set(side * (spec.hullWidth / 2 + 0.02), spec.hullHeight * 0.55, 0);
		group.add(hangarStripe);
	});

	SIDES.forEach((side) => {
		const eng = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.35, spec.hullHeight * 0.55, 0.18),
			mats.engine,
		);
		eng.position.set(side * spec.hullWidth * 0.3, spec.hullHeight * 0.5, -spec.hullLength / 2 - 0.09);
		group.add(eng);
	});
};

const SHIP_DETAILS: Record<ShipClass, ShipDetailBuilder> = {
	carrier: addCarrierDetails,
	corvette: addCorvetteDetails,
	frigate: addFrigateDetails,
	destroyer: addDestroyerDetails,
	dreadnought: addDreadnoughtDetails,
};

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

export function spawnShipTurrets(ecs: World, ownerId: number, spec: ShipSpec, built: BuiltShip): void {
	spec.turrets.forEach((mountSpec, idx) => {
		const mount = built.turretMounts[idx];
		if (!mount) return;
		ecs.spawn({ ...turretFromMount(ownerId, 'ally', mountSpec, mount) });
	});
	(spec.cannonTurrets ?? []).forEach((mountSpec, idx) => {
		const mount = built.cannonTurretMounts[idx];
		if (!mount) return;
		ecs.spawn({ ...cannonTurretFromMount(ownerId, 'ally', mountSpec, mount) });
	});
	(spec.beamTurrets ?? []).forEach((mountSpec, idx) => {
		const beamMount = built.beamTurretMounts[idx];
		if (!beamMount) return;
		ecs.spawn({ ...beamTurretFromMount(ownerId, 'ally', mountSpec, beamMount.mount, beamMount.beamMesh) });
	});
	(spec.missileTurrets ?? []).forEach((mountSpec, idx) => {
		const mount = built.missileTurretMounts[idx];
		if (!mount) return;
		ecs.spawn({ ...missileTurretFromMount(ownerId, mountSpec, mount) });
	});
}

const CARRIER_ACCENT_MAT = new MeshStandardMaterial({ color: 0x222833, roughness: 0.6, metalness: 0.2 });
CARRIER_ACCENT_MAT.userData.shared = true;

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

export function buildCarrierLoadoutVisual(
	spec: ShipSpec,
	built: BuiltShip,
	loadout: CarrierLoadout,
): void {
	(spec.emptyTurretMounts ?? []).forEach((emptyMount, idx) => {
		const pylon = loadout.pylons[idx];
		if (pylon) materializeLoadoutMount(spec, built, emptyMount, idx, pylon);
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
	(spec.emptyTurretMounts ?? []).forEach((emptyMount, idx) => {
		const pylon = loadout.pylons[idx];
		if (!pylon) return;
		const result = materializeLoadoutMount(spec, built, emptyMount, idx, pylon);
		if (!result) return;
		ecs.spawn({ ...loadoutComponentsFor(ownerId, result) });
	});
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

export function createShipGroup(shipClass: ShipClass): BuiltShip {
	const spec = SHIP_SPECS[shipClass];
	const group = new Group();

	const mats: ShipMaterials = {
		hull: new MeshStandardMaterial({ color: spec.color, roughness: 0.55, metalness: 0.25 }),
		accent: new MeshStandardMaterial({ color: 0x222833, roughness: 0.6, metalness: 0.2 }),
		engine: new MeshStandardMaterial({
			color: 0x88ccff,
			emissive: 0x4488ff,
			emissiveIntensity: 0.9,
			roughness: 0.3,
			metalness: 0.4,
		}),
	};

	const hull = new Mesh(new BoxGeometry(spec.hullWidth, spec.hullHeight, spec.hullLength), mats.hull);
	hull.position.y = spec.hullHeight / 2;
	group.add(hull);

	if (!spec.flatBow) {
		const bow = new Mesh(new ConeGeometry(spec.hullWidth * 0.55, spec.hullLength * 0.35, 12), mats.hull);
		bow.position.set(0, spec.hullHeight / 2, spec.hullLength / 2 + spec.hullLength * 0.17);
		bow.rotation.x = Math.PI / 2;
		group.add(bow);
	}

	SHIP_DETAILS[shipClass](group, spec, mats);

	const turretMounts: Group[] = spec.turrets.map((mount) => {
		const turretGroup = buildTurretMountGroup(mount, spec.hullHeight, mats.accent);
		group.add(turretGroup);
		return turretGroup;
	});

	const cannonTurretMounts: Group[] = (spec.cannonTurrets ?? []).map((mount) => {
		const turretGroup = buildTurretMountGroup(mount, spec.hullHeight, mats.accent);
		group.add(turretGroup);
		return turretGroup;
	});

	const beamTurretMounts: BeamMountBuild[] = (spec.beamTurrets ?? []).map((mount) => {
		const built = buildBeamMountGroup(mount, spec.hullHeight, mats.accent);
		group.add(built.mount);
		return built;
	});

	const missileTurretMounts: Group[] = (spec.missileTurrets ?? []).map((mount) => {
		const launcherGroup = buildMissileMountGroup(mount, spec.hullHeight, mats.accent);
		group.add(launcherGroup);
		return launcherGroup;
	});

	const emptyTurretMountGroups: Group[] = (spec.emptyTurretMounts ?? []).map((mount) => {
		const emptyGroup = buildEmptyMountGroup(mount, spec.hullHeight, mats.accent);
		group.add(emptyGroup);
		return emptyGroup;
	});

	return { group, turretMounts, cannonTurretMounts, beamTurretMounts, missileTurretMounts, emptyTurretMountGroups };
}

const ENEMY_ACCENT_MAT = new MeshStandardMaterial({ color: 0x2a1418, roughness: 0.6, metalness: 0.2 });

const enemyHullMat = (kind: EnemyKind): MeshStandardMaterial => new MeshStandardMaterial({
	color: ENEMY_SPECS[kind].color,
	roughness: 0.5,
	metalness: 0.25,
	emissive: ENEMY_SPECS[kind].color,
	emissiveIntensity: 0.12,
});

const ENEMY_HULL_MATS: Record<EnemyKind, MeshStandardMaterial> = {
	pursuer: enemyHullMat('pursuer'),
	interceptor: enemyHullMat('interceptor'),
	flanker: enemyHullMat('flanker'),
	orbiter: enemyHullMat('orbiter'),
	gunship: enemyHullMat('gunship'),
	brawler: enemyHullMat('brawler'),
	sniper: enemyHullMat('sniper'),
};

type EnemyDetailBuilder = (group: Group, hullMat: MeshStandardMaterial) => void;

const noEnemyDetails: EnemyDetailBuilder = () => {};

const addInterceptorDetails: EnemyDetailBuilder = (group, hullMat) => {
	const antenna = new Mesh(
		new CylinderGeometry(0.04, 0.04, ENEMY_HULL_LENGTH * 0.45, 6),
		hullMat,
	);
	antenna.position.set(0, ENEMY_HULL_HEIGHT * 0.85, ENEMY_HULL_LENGTH * 0.15);
	group.add(antenna);
};

const addFlankerDetails: EnemyDetailBuilder = (group, hullMat) => {
	SIDES.forEach((side) => {
		const wing = new Mesh(
			new BoxGeometry(ENEMY_HULL_WIDTH * 0.7, ENEMY_HULL_HEIGHT * 0.25, ENEMY_HULL_LENGTH * 0.35),
			hullMat,
		);
		wing.position.set(side * ENEMY_HULL_WIDTH * 0.7, ENEMY_HULL_HEIGHT * 0.4, -ENEMY_HULL_LENGTH * 0.05);
		wing.rotation.y = side * 0.45;
		group.add(wing);
	});
};

const addOrbiterDetails: EnemyDetailBuilder = (group, hullMat) => {
	SIDES.forEach((side) => {
		const fin = new Mesh(
			new BoxGeometry(ENEMY_HULL_WIDTH * 0.9, ENEMY_HULL_HEIGHT * 0.2, ENEMY_HULL_LENGTH * 0.25),
			hullMat,
		);
		fin.position.set(side * ENEMY_HULL_WIDTH * 0.7, ENEMY_HULL_HEIGHT * 0.5, 0);
		group.add(fin);
	});
	const dorsalFin = new Mesh(
		new BoxGeometry(ENEMY_HULL_WIDTH * 0.2, ENEMY_HULL_HEIGHT * 0.8, ENEMY_HULL_LENGTH * 0.5),
		hullMat,
	);
	dorsalFin.position.set(0, ENEMY_HULL_HEIGHT * 0.85, 0);
	group.add(dorsalFin);
};

const ENEMY_DETAILS: Record<EnemyKind, EnemyDetailBuilder> = {
	pursuer: noEnemyDetails,
	interceptor: addInterceptorDetails,
	flanker: addFlankerDetails,
	orbiter: addOrbiterDetails,
	gunship: noEnemyDetails,
	brawler: noEnemyDetails,
	sniper: noEnemyDetails,
};

export interface BuiltEnemy {
	readonly group: Group;
	readonly turretMount: Group | null;
}

export function enemyShipGroup(kind: EnemyKind): BuiltEnemy {
	const spec = ENEMY_SPECS[kind];
	const group = new Group();
	const hullMat = ENEMY_HULL_MATS[kind];

	const hull = new Mesh(
		new BoxGeometry(spec.hullWidth, spec.hullHeight, spec.hullLength),
		hullMat,
	);
	hull.position.y = spec.hullHeight / 2;
	group.add(hull);

	const bow = new Mesh(
		new ConeGeometry(spec.hullWidth * 0.6, spec.hullLength * 0.55, 8),
		hullMat,
	);
	bow.position.set(0, spec.hullHeight / 2, spec.hullLength / 2 + spec.hullLength * 0.27);
	bow.rotation.x = Math.PI / 2;
	group.add(bow);

	const tailFin = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.25, spec.hullHeight * 1.1, spec.hullLength * 0.3),
		ENEMY_ACCENT_MAT,
	);
	tailFin.position.set(0, spec.hullHeight * 0.65, -spec.hullLength / 2 - spec.hullLength * 0.08);
	group.add(tailFin);

	ENEMY_DETAILS[kind](group, hullMat);

	const turretMount = spec.turretMount
		? buildTurretMountGroup(spec.turretMount, spec.hullHeight, ENEMY_ACCENT_MAT)
		: null;
	if (turretMount) group.add(turretMount);

	return { group, turretMount };
}

export function projectileMesh(): Mesh {
	const geo = new CylinderGeometry(0.08, 0.08, 0.5, 6);
	geo.rotateX(Math.PI / 2);
	const mat = new MeshStandardMaterial({ color: 0xffee88, emissive: 0xffaa33, emissiveIntensity: 1.2, roughness: 0.3 });
	return new Mesh(geo, mat);
}

const MISSILE_GEO = (() => {
	const g = new CylinderGeometry(0.1, 0.1, 0.8, 8);
	g.rotateX(Math.PI / 2);
	return g;
})();
const MISSILE_MAT = new MeshStandardMaterial({ color: 0xff5533, emissive: 0xaa2200, emissiveIntensity: 0.9, roughness: 0.4 });
MISSILE_GEO.userData.shared = true;
MISSILE_MAT.userData.shared = true;

export function missileMesh(): Mesh {
	return new Mesh(MISSILE_GEO, MISSILE_MAT);
}

const CANNON_SHELL_GEO = (() => {
	const g = new CylinderGeometry(0.16, 0.16, 0.6, 10);
	g.rotateX(Math.PI / 2);
	return g;
})();
const CANNON_SHELL_MAT = new MeshStandardMaterial({ color: 0xff7733, emissive: 0xdd3300, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.3 });
CANNON_SHELL_GEO.userData.shared = true;
CANNON_SHELL_MAT.userData.shared = true;

export function cannonShellMesh(): Mesh {
	return new Mesh(CANNON_SHELL_GEO, CANNON_SHELL_MAT);
}

const RAILGUN_SHELL_GEO = (() => {
	const g = new CylinderGeometry(0.05, 0.05, 1.2, 8);
	g.rotateX(Math.PI / 2);
	return g;
})();
const RAILGUN_SHELL_MAT = new MeshStandardMaterial({ color: 0xaaffff, emissive: 0x66ffff, emissiveIntensity: 2.0, roughness: 0.3, metalness: 0.5 });
RAILGUN_SHELL_GEO.userData.shared = true;
RAILGUN_SHELL_MAT.userData.shared = true;

export function railgunMesh(): Mesh {
	return new Mesh(RAILGUN_SHELL_GEO, RAILGUN_SHELL_MAT);
}

const PD_SHELL_GEO = (() => {
	const g = new CylinderGeometry(0.06, 0.06, 0.3, 6);
	g.rotateX(Math.PI / 2);
	return g;
})();
const PD_SHELL_MAT = new MeshStandardMaterial({ color: 0xffee66, emissive: 0xffaa22, emissiveIntensity: 1.4, roughness: 0.35 });
PD_SHELL_GEO.userData.shared = true;
PD_SHELL_MAT.userData.shared = true;

export function pdMesh(): Mesh {
	return new Mesh(PD_SHELL_GEO, PD_SHELL_MAT);
}

interface BuiltBlast {
	readonly mesh: Mesh;
	readonly material: MeshBasicMaterial;
}

const BLAST_GEO = (() => {
	const g = new RingGeometry(0.82, 1.0, 32);
	g.rotateX(-Math.PI / 2);
	return g;
})();

export function createBlast(): BuiltBlast {
	const material = new MeshBasicMaterial({
		color: 0xff8844,
		transparent: true,
		opacity: 0.9,
		side: DoubleSide,
		depthWrite: false,
	});
	const mesh = new Mesh(BLAST_GEO, material);
	return { mesh, material };
}

export function pickupMesh(): Mesh {
	const geo = new BoxGeometry(0.35, 0.35, 0.35);
	const mat = new MeshStandardMaterial({ color: 0xffcc33, emissive: 0xaa7711, emissiveIntensity: 0.8, roughness: 0.35, metalness: 0.6 });
	const mesh = new Mesh(geo, mat);
	mesh.position.y = 0.25;
	return mesh;
}
