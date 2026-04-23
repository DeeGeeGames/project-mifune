import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import {
	ENEMY_HULL_LENGTH,
	ENEMY_HULL_WIDTH,
	ENEMY_HULL_HEIGHT,
	ENGINE_PLUME_COLOR_ENEMY,
} from '../constants';
import { ENEMY_SPECS, type EnemyKind } from '../enemies';
import {
	attachEnginePlume,
	buildTurretMountGroup,
	createEngineMaterial,
	engineSize,
	type EngineMount,
} from './mounts';

export interface BuiltEnemy {
	readonly group: Group;
	readonly turretMount: Group | null;
	readonly engineMaterial: MeshStandardMaterial;
	readonly engineMounts: readonly EngineMount[];
}

const SIDES = [-1, 1] as const;

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

export function enemyShipGroup(kind: EnemyKind): BuiltEnemy {
	const spec = ENEMY_SPECS[kind];
	const group = new Group();
	const hullMat = ENEMY_HULL_MATS[kind];
	const engineMat = createEngineMaterial(0xffaa66, 0xff6622);

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

	const engW = spec.hullWidth * 0.55;
	const engH = spec.hullHeight * 0.55;
	const engD = 0.12;
	const eng = new Mesh(new BoxGeometry(engW, engH, engD), engineMat);
	eng.position.set(0, spec.hullHeight * 0.5, -spec.hullLength / 2 - engD / 2);
	group.add(eng);
	const engineMounts: readonly EngineMount[] = [
		attachEnginePlume(eng, engD, engineSize(engW, engH), ENGINE_PLUME_COLOR_ENEMY),
	];

	ENEMY_DETAILS[kind](group, hullMat);

	const turretMount = spec.turretMount
		? buildTurretMountGroup(spec.turretMount, spec.hullHeight, ENEMY_ACCENT_MAT)
		: null;
	if (turretMount) group.add(turretMount);

	return { group, turretMount, engineMaterial: engineMat, engineMounts };
}
