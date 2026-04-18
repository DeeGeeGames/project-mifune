import {
	Group,
	Mesh,
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	MeshStandardMaterial,
} from 'three';
import {
	ENEMY_HULL_LENGTH,
	ENEMY_HULL_WIDTH,
	ENEMY_HULL_HEIGHT,
	TURRET_CONE_HALF,
	TURRET_FIRE_INTERVAL_MS,
	TURRET_RANGE,
	BULLET_DAMAGE,
	MISSILE_TURRET_CONE_HALF,
	MISSILE_TURRET_FIRE_INTERVAL_MS,
	MISSILE_TURRET_RANGE,
	MISSILE_DAMAGE,
} from './constants';
import type { Faction, World } from './types';
import { ENEMY_SPECS, type EnemyKind } from './enemies';

export type ShipClass = 'carrier' | 'corvette' | 'frigate' | 'destroyer' | 'dreadnought';

export interface TurretMount {
	readonly x: number;
	readonly z: number;
	readonly baseAngle: number;
	readonly coneHalf?: number;
	readonly range?: number;
	readonly fireIntervalMs?: number;
	readonly damage?: number;
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
	readonly missileTurrets?: readonly MissileTurretMount[];
	readonly flatBow?: true;
}

const FRONT = 0;
const PORT = -Math.PI / 2;
const STARBOARD = Math.PI / 2;
const PORT_FORE = -Math.PI / 4;
const STARBOARD_FORE = Math.PI / 4;

export const SHIP_SPECS: Record<ShipClass, ShipSpec> = {
	carrier: {
		hullLength: 11.0,
		hullWidth: 2.4,
		hullHeight: 0.8,
		color: 0x8a94a6,
		turnRate: 0.08,
		turnAccel: 0.05,
		accel: 0.25,
		maxSpeed: 1.8,
		drag: 0.3,
		hp: 100,
		cost: 0,
		turrets: [],
		missileTurrets: [
			{ x: -1.0, z: 0, baseAngle: FRONT, fireAngle: PORT },
			{ x: 1.0, z: 0, baseAngle: FRONT, fireAngle: STARBOARD },
		],
		flatBow: true,
	},
	corvette: {
		hullLength: 6.2,
		hullWidth: 1.45,
		hullHeight: 0.45,
		color: 0x33ccee,
		turnRate: 0.3,
		turnAccel: 0.4,
		accel: 0.75,
		maxSpeed: 4,
		drag: 0.3,
		hp: 10,
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
		turnRate: 0.225,
		turnAccel: 0.25,
		accel: 0.625,
		maxSpeed: 3.5,
		drag: 0.3,
		hp: 20,
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
		turnRate: 0.175,
		turnAccel: 0.15,
		accel: 0.5,
		maxSpeed: 3,
		drag: 0.3,
		hp: 35,
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
		turnRate: 0.125,
		turnAccel: 0.1,
		accel: 0.375,
		maxSpeed: 2.5,
		drag: 0.3,
		hp: 60,
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

function buildTurretMountGroup(
	mountSpec: TurretMount,
	hullHeight: number,
	accentMat: MeshStandardMaterial,
): Group {
	const turretGroup = new Group();
	turretGroup.position.set(mountSpec.x, hullHeight, mountSpec.z);
	turretGroup.rotation.y = mountSpec.baseAngle;

	const base = new Mesh(
		new CylinderGeometry(TURRET_BASE_RADIUS, TURRET_BASE_RADIUS, TURRET_BASE_HEIGHT, 10),
		accentMat,
	);
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

const LAUNCHER_BODY_W = 0.5;
const LAUNCHER_BODY_H = 0.2;
const LAUNCHER_BODY_L = 0.7;
const LAUNCHER_TIP_W = 0.35;
const LAUNCHER_TIP_H = 0.16;
const LAUNCHER_TIP_L = 0.18;
const LAUNCHER_TIP_Z = 0.42;

export interface BuiltShip {
	readonly group: Group;
	readonly turretMounts: readonly Group[];
	readonly missileTurretMounts: readonly Group[];
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
		ownerId,
		faction,
		mountX: mountSpec.x,
		mountZ: mountSpec.z,
		baseAngle: mountSpec.baseAngle,
		aimAngle: mountSpec.baseAngle,
		coneHalf: mountSpec.coneHalf ?? TURRET_CONE_HALF,
		range: mountSpec.range ?? TURRET_RANGE,
		fireIntervalMs: mountSpec.fireIntervalMs ?? TURRET_FIRE_INTERVAL_MS,
		damage: mountSpec.damage ?? BULLET_DAMAGE,
		lastFiredAt: 0,
		hasTarget: false,
		mount,
	};
}

export function spawnShipTurrets(ecs: World, ownerId: number, spec: ShipSpec, built: BuiltShip): void {
	spec.turrets.forEach((mountSpec, idx) => {
		const mount = built.turretMounts[idx];
		if (!mount) return;
		ecs.spawn({ turret: turretFromMount(ownerId, 'ally', mountSpec, mount) });
	});
	(spec.missileTurrets ?? []).forEach((mountSpec, idx) => {
		const mount = built.missileTurretMounts[idx];
		if (!mount) return;
		ecs.spawn({ missileTurret: missileTurretFromMount(ownerId, mountSpec, mount) });
	});
}

export function missileTurretFromMount(ownerShipId: number, mountSpec: MissileTurretMount, mount: Group) {
	return {
		ownerShipId,
		mountX: mountSpec.x,
		mountZ: mountSpec.z,
		baseAngle: mountSpec.baseAngle,
		fireAngle: mountSpec.fireAngle,
		coneHalf: mountSpec.coneHalf ?? MISSILE_TURRET_CONE_HALF,
		range: mountSpec.range ?? MISSILE_TURRET_RANGE,
		fireIntervalMs: mountSpec.fireIntervalMs ?? MISSILE_TURRET_FIRE_INTERVAL_MS,
		damage: mountSpec.damage ?? MISSILE_DAMAGE,
		lastFiredAt: 0,
		mount,
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

	const missileTurretMounts: Group[] = (spec.missileTurrets ?? []).map((mount) => {
		const launcherGroup = new Group();
		launcherGroup.position.set(mount.x, spec.hullHeight, mount.z);
		launcherGroup.rotation.y = mount.fireAngle;

		const body = new Mesh(
			new BoxGeometry(LAUNCHER_BODY_W, LAUNCHER_BODY_H, LAUNCHER_BODY_L),
			mats.accent,
		);
		body.position.set(0, LAUNCHER_BODY_H / 2, 0);
		launcherGroup.add(body);

		const tip = new Mesh(
			new BoxGeometry(LAUNCHER_TIP_W, LAUNCHER_TIP_H, LAUNCHER_TIP_L),
			BARREL_MAT,
		);
		tip.position.set(0, LAUNCHER_BODY_H / 2, LAUNCHER_TIP_Z);
		launcherGroup.add(tip);

		group.add(launcherGroup);
		return launcherGroup;
	});

	return { group, turretMounts, missileTurretMounts };
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

export function missileMesh(): Mesh {
	return new Mesh(MISSILE_GEO, MISSILE_MAT);
}

export function pickupMesh(): Mesh {
	const geo = new BoxGeometry(0.35, 0.35, 0.35);
	const mat = new MeshStandardMaterial({ color: 0xffcc33, emissive: 0xaa7711, emissiveIntensity: 0.8, roughness: 0.35, metalness: 0.6 });
	const mesh = new Mesh(geo, mat);
	mesh.position.y = 0.25;
	return mesh;
}
