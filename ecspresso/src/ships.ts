import {
	Group,
	Mesh,
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	MeshStandardMaterial,
} from 'three';

export type ShipClass = 'corvette' | 'frigate' | 'destroyer' | 'dreadnought';

export interface TurretMount {
	readonly x: number;
	readonly z: number;
	readonly baseAngle: number;
}

export interface ShipSpec {
	readonly hullLength: number;
	readonly hullWidth: number;
	readonly hullHeight: number;
	readonly color: number;
	readonly turnRate: number;
	readonly accel: number;
	readonly maxSpeed: number;
	readonly drag: number;
	readonly hp: number;
	readonly cost: number;
	readonly turrets: readonly TurretMount[];
}

const FRONT = 0;
const PORT = -Math.PI / 2;
const STARBOARD = Math.PI / 2;

export const SHIP_SPECS: Record<ShipClass, ShipSpec> = {
	corvette: {
		hullLength: 2.2,
		hullWidth: 0.9,
		hullHeight: 0.45,
		color: 0x33ccee,
		turnRate: 1.2,
		accel: 6,
		maxSpeed: 8,
		drag: 0.6,
		hp: 10,
		cost: 0,
		turrets: [
			{ x: 0, z: 0.7, baseAngle: FRONT },
		],
	},
	frigate: {
		hullLength: 2.8,
		hullWidth: 1.1,
		hullHeight: 0.5,
		color: 0x55cc55,
		turnRate: 0.9,
		accel: 5,
		maxSpeed: 7,
		drag: 0.6,
		hp: 20,
		cost: 100,
		turrets: [
			{ x: -0.55, z: 0.1, baseAngle: PORT },
			{ x: 0.55, z: 0.1, baseAngle: STARBOARD },
		],
	},
	destroyer: {
		hullLength: 3.4,
		hullWidth: 1.3,
		hullHeight: 0.55,
		color: 0xff9933,
		turnRate: 0.7,
		accel: 4,
		maxSpeed: 6,
		drag: 0.6,
		hp: 35,
		cost: 250,
		turrets: [
			{ x: 0, z: 1.2, baseAngle: FRONT },
			{ x: -0.65, z: -0.3, baseAngle: PORT },
			{ x: 0.65, z: -0.3, baseAngle: STARBOARD },
		],
	},
	dreadnought: {
		hullLength: 4.4,
		hullWidth: 1.6,
		hullHeight: 0.7,
		color: 0xdd3344,
		turnRate: 0.5,
		accel: 3,
		maxSpeed: 5,
		drag: 0.6,
		hp: 60,
		cost: 500,
		turrets: [
			{ x: 0, z: 1.7, baseAngle: FRONT },
			{ x: -0.8, z: 0.4, baseAngle: PORT },
			{ x: 0.8, z: 0.4, baseAngle: STARBOARD },
			{ x: -0.8, z: -0.8, baseAngle: PORT },
			{ x: 0.8, z: -0.8, baseAngle: STARBOARD },
		],
	},
};

const BARREL_LENGTH = 0.9;
const BARREL_RADIUS = 0.08;
const TURRET_BASE_RADIUS = 0.25;
const TURRET_BASE_HEIGHT = 0.25;

export interface BuiltShip {
	readonly group: Group;
	readonly turretMounts: readonly Group[];
}

export function createShipGroup(shipClass: ShipClass): BuiltShip {
	const spec = SHIP_SPECS[shipClass];
	const group = new Group();

	const hullMat = new MeshStandardMaterial({ color: spec.color, roughness: 0.55, metalness: 0.25 });
	const accentMat = new MeshStandardMaterial({ color: 0x222833, roughness: 0.6, metalness: 0.2 });
	const barrelMat = new MeshStandardMaterial({ color: 0x111418, roughness: 0.45, metalness: 0.4 });

	const hull = new Mesh(new BoxGeometry(spec.hullWidth, spec.hullHeight, spec.hullLength), hullMat);
	hull.position.y = spec.hullHeight / 2;
	group.add(hull);

	const bow = new Mesh(new ConeGeometry(spec.hullWidth * 0.55, spec.hullLength * 0.35, 12), hullMat);
	bow.position.set(0, spec.hullHeight / 2, spec.hullLength / 2 + spec.hullLength * 0.17);
	bow.rotation.x = Math.PI / 2;
	group.add(bow);

	const stripe = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.15, spec.hullHeight * 0.5, spec.hullLength * 0.9),
		accentMat,
	);
	stripe.position.set(0, spec.hullHeight + 0.01, 0);
	group.add(stripe);

	const turretMounts: Group[] = spec.turrets.map((mount) => {
		const turretGroup = new Group();
		turretGroup.position.set(mount.x, spec.hullHeight, mount.z);
		turretGroup.rotation.y = mount.baseAngle;

		const base = new Mesh(
			new CylinderGeometry(TURRET_BASE_RADIUS, TURRET_BASE_RADIUS, TURRET_BASE_HEIGHT, 10),
			accentMat,
		);
		base.position.y = TURRET_BASE_HEIGHT / 2;
		turretGroup.add(base);

		const barrel = new Mesh(
			new CylinderGeometry(BARREL_RADIUS, BARREL_RADIUS, BARREL_LENGTH, 8),
			barrelMat,
		);
		barrel.position.set(0, TURRET_BASE_HEIGHT + 0.02, BARREL_LENGTH / 2);
		barrel.rotation.x = Math.PI / 2;
		turretGroup.add(barrel);

		group.add(turretGroup);
		return turretGroup;
	});

	return { group, turretMounts };
}

export function enemyMesh(): Mesh {
	const geo = new ConeGeometry(0.55, 1.1, 6);
	const mat = new MeshStandardMaterial({ color: 0xcc33aa, roughness: 0.4, metalness: 0.2, emissive: 0x330022 });
	const mesh = new Mesh(geo, mat);
	mesh.rotation.x = Math.PI;
	mesh.position.y = 0.55;
	return mesh;
}

export function projectileMesh(): Mesh {
	const geo = new CylinderGeometry(0.08, 0.08, 0.5, 6);
	const mat = new MeshStandardMaterial({ color: 0xffee88, emissive: 0xffaa33, emissiveIntensity: 1.2, roughness: 0.3 });
	const mesh = new Mesh(geo, mat);
	mesh.rotation.x = Math.PI / 2;
	return mesh;
}

export function pickupMesh(): Mesh {
	const geo = new BoxGeometry(0.35, 0.35, 0.35);
	const mat = new MeshStandardMaterial({ color: 0xffcc33, emissive: 0xaa7711, emissiveIntensity: 0.8, roughness: 0.35, metalness: 0.6 });
	const mesh = new Mesh(geo, mat);
	mesh.position.y = 0.25;
	return mesh;
}
