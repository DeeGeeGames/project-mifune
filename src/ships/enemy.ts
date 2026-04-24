import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
	ENEMY_HULL_LENGTH,
	ENEMY_HULL_WIDTH,
	ENEMY_HULL_HEIGHT,
	ENGINE_PLUME_COLOR_ENEMY,
} from '../constants';
import { ENEMY_SPECS, type EnemyKind, type EnemySpec } from '../enemies';
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
const ENEMY_COMMAND_MAT = new MeshStandardMaterial({ color: 0x4a1d12, roughness: 0.5, metalness: 0.3 });

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

function addEngineBlock(
	group: Group,
	engineMat: MeshStandardMaterial,
	x: number,
	y: number,
	z: number,
	width: number,
	height: number,
	depth: number,
): EngineMount {
	const engine = new Mesh(new BoxGeometry(width, height, depth), engineMat);
	engine.position.set(x, y, z);
	group.add(engine);
	return attachEnginePlume(engine, depth, engineSize(width, height), ENGINE_PLUME_COLOR_ENEMY);
}

type HullBuilder = (
	group: Group,
	spec: EnemySpec,
	hullMat: MeshStandardMaterial,
	engineMat: MeshStandardMaterial,
) => readonly EngineMount[];

const buildDefaultEnemyHull: HullBuilder = (group, spec, hullMat, engineMat) => {
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

	return [
		addEngineBlock(
			group,
			engineMat,
			0,
			spec.hullHeight * 0.5,
			-spec.hullLength / 2 - engD / 2,
			engW,
			engH,
			engD,
		),
	];
};

const buildBrawlerHull: HullBuilder = (group, spec, hullMat, engineMat) => {
	const mainHull = new Mesh(
		new RoundedBoxGeometry(
			spec.hullWidth * 0.8,
			spec.hullHeight * 0.95,
			spec.hullLength * 0.72,
			4,
			Math.min(spec.hullWidth, spec.hullHeight) * 0.16,
		),
		hullMat,
	);
	mainHull.position.set(0, spec.hullHeight * 0.48, -spec.hullLength * 0.06);
	group.add(mainHull);

	const prow = new Mesh(
		new ConeGeometry(spec.hullWidth * 0.54, spec.hullLength * 0.5, 10),
		hullMat,
	);
	prow.position.set(0, spec.hullHeight * 0.45, spec.hullLength * 0.37);
	prow.rotation.x = Math.PI / 2;
	group.add(prow);

	const ram = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.22, spec.hullHeight * 0.34, spec.hullLength * 0.26),
		ENEMY_ACCENT_MAT,
	);
	ram.position.set(0, spec.hullHeight * 0.2, spec.hullLength * 0.72);
	group.add(ram);

	const dorsalCitadel = new Mesh(
		new RoundedBoxGeometry(
			spec.hullWidth * 0.38,
			spec.hullHeight * 0.42,
			spec.hullLength * 0.22,
			3,
			spec.hullHeight * 0.07,
		),
		ENEMY_COMMAND_MAT,
	);
	dorsalCitadel.position.set(0, spec.hullHeight * 0.83, -spec.hullLength * 0.12);
	group.add(dorsalCitadel);

	const spine = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.16, spec.hullHeight * 0.12, spec.hullLength * 0.58),
		ENEMY_ACCENT_MAT,
	);
	spine.position.set(0, spec.hullHeight * 0.74, -spec.hullLength * 0.04);
	group.add(spine);

	SIDES.forEach((side) => {
		const sponson = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.24, spec.hullHeight * 0.72, spec.hullLength * 0.56),
			hullMat,
		);
		sponson.position.set(side * spec.hullWidth * 0.55, spec.hullHeight * 0.38, -spec.hullLength * 0.1);
		sponson.rotation.y = side * 0.08;
		group.add(sponson);

		const shoulder = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.22, spec.hullHeight * 0.26, spec.hullLength * 0.24),
			ENEMY_ACCENT_MAT,
		);
		shoulder.position.set(side * spec.hullWidth * 0.44, spec.hullHeight * 0.55, spec.hullLength * 0.3);
		shoulder.rotation.y = side * 0.16;
		group.add(shoulder);

		const tailArmor = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.12, spec.hullHeight * 0.3, spec.hullLength * 0.28),
			ENEMY_ACCENT_MAT,
		);
		tailArmor.position.set(side * spec.hullWidth * 0.38, spec.hullHeight * 0.6, -spec.hullLength * 0.47);
		group.add(tailArmor);
	});

	const keel = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.42, spec.hullHeight * 0.18, spec.hullLength * 0.48),
		ENEMY_ACCENT_MAT,
	);
	keel.position.set(0, spec.hullHeight * 0.08, spec.hullLength * 0.02);
	group.add(keel);

	const engineWidth = spec.hullWidth * 0.24;
	const engineHeight = spec.hullHeight * 0.42;
	const engineDepth = 0.16;

	return SIDES.map((side) => addEngineBlock(
		group,
		engineMat,
		side * spec.hullWidth * 0.29,
		spec.hullHeight * 0.34,
		-spec.hullLength / 2 - engineDepth / 2,
		engineWidth,
		engineHeight,
		engineDepth,
	));
};

const buildGunshipHull: HullBuilder = (group, spec, hullMat, engineMat) => {
	const mainHull = new Mesh(
		new RoundedBoxGeometry(
			spec.hullWidth * 0.72,
			spec.hullHeight * 0.88,
			spec.hullLength * 0.78,
			4,
			Math.min(spec.hullWidth, spec.hullHeight) * 0.14,
		),
		hullMat,
	);
	mainHull.position.set(0, spec.hullHeight * 0.45, -spec.hullLength * 0.05);
	group.add(mainHull);

	const prow = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.36, spec.hullHeight * 0.3, spec.hullLength * 0.34),
		hullMat,
	);
	prow.position.set(0, spec.hullHeight * 0.28, spec.hullLength * 0.49);
	group.add(prow);

	const bridge = new Mesh(
		new RoundedBoxGeometry(
			spec.hullWidth * 0.26,
			spec.hullHeight * 0.34,
			spec.hullLength * 0.18,
			3,
			spec.hullHeight * 0.06,
		),
		ENEMY_COMMAND_MAT,
	);
	bridge.position.set(0, spec.hullHeight * 0.82, -spec.hullLength * 0.04);
	group.add(bridge);

	const dorsalStrip = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.12, spec.hullHeight * 0.08, spec.hullLength * 0.6),
		ENEMY_ACCENT_MAT,
	);
	dorsalStrip.position.set(0, spec.hullHeight * 0.72, -spec.hullLength * 0.02);
	group.add(dorsalStrip);

	SIDES.forEach((side) => {
		const flank = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.18, spec.hullHeight * 0.56, spec.hullLength * 0.5),
			hullMat,
		);
		flank.position.set(side * spec.hullWidth * 0.47, spec.hullHeight * 0.3, -spec.hullLength * 0.06);
		group.add(flank);

		const intake = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.14, spec.hullHeight * 0.16, spec.hullLength * 0.14),
			ENEMY_ACCENT_MAT,
		);
		intake.position.set(side * spec.hullWidth * 0.42, spec.hullHeight * 0.18, spec.hullLength * 0.26);
		group.add(intake);

		const engineCowl = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.16, spec.hullHeight * 0.24, spec.hullLength * 0.16),
			ENEMY_ACCENT_MAT,
		);
		engineCowl.position.set(side * spec.hullWidth * 0.33, spec.hullHeight * 0.42, -spec.hullLength * 0.44);
		group.add(engineCowl);
	});

	const belly = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.3, spec.hullHeight * 0.14, spec.hullLength * 0.44),
		ENEMY_ACCENT_MAT,
	);
	belly.position.set(0, spec.hullHeight * 0.08, spec.hullLength * 0.04);
	group.add(belly);

	const engineWidth = spec.hullWidth * 0.18;
	const engineHeight = spec.hullHeight * 0.26;
	const engineDepth = 0.16;

	return SIDES.map((side) => addEngineBlock(
		group,
		engineMat,
		side * spec.hullWidth * 0.23,
		spec.hullHeight * 0.32,
		-spec.hullLength / 2 - engineDepth / 2,
		engineWidth,
		engineHeight,
		engineDepth,
	));
};

const buildSniperHull: HullBuilder = (group, spec, hullMat, engineMat) => {
	const spine = new Mesh(
		new RoundedBoxGeometry(
			spec.hullWidth * 0.56,
			spec.hullHeight * 0.82,
			spec.hullLength * 0.86,
			4,
			Math.min(spec.hullWidth, spec.hullHeight) * 0.16,
		),
		hullMat,
	);
	spine.position.set(0, spec.hullHeight * 0.42, -spec.hullLength * 0.02);
	group.add(spine);

	const prow = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.14, spec.hullHeight * 0.16, spec.hullLength * 0.42),
		ENEMY_ACCENT_MAT,
	);
	prow.position.set(0, spec.hullHeight * 0.28, spec.hullLength * 0.46);
	group.add(prow);

	const sensorBlock = new Mesh(
		new RoundedBoxGeometry(
			spec.hullWidth * 0.22,
			spec.hullHeight * 0.26,
			spec.hullLength * 0.18,
			3,
			spec.hullHeight * 0.06,
		),
		ENEMY_COMMAND_MAT,
	);
	sensorBlock.position.set(0, spec.hullHeight * 0.76, spec.hullLength * 0.08);
	group.add(sensorBlock);

	SIDES.forEach((side) => {
		const outrigger = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.16, spec.hullHeight * 0.16, spec.hullLength * 0.58),
			hullMat,
		);
		outrigger.position.set(side * spec.hullWidth * 0.48, spec.hullHeight * 0.22, -spec.hullLength * 0.02);
		group.add(outrigger);

		const rail = new Mesh(
			new BoxGeometry(spec.hullWidth * 0.05, spec.hullHeight * 0.18, spec.hullLength * 0.72),
			ENEMY_ACCENT_MAT,
		);
		rail.position.set(side * spec.hullWidth * 0.27, spec.hullHeight * 0.38, 0);
		group.add(rail);
	});

	const tail = new Mesh(
		new BoxGeometry(spec.hullWidth * 0.22, spec.hullHeight * 0.24, spec.hullLength * 0.18),
		ENEMY_ACCENT_MAT,
	);
	tail.position.set(0, spec.hullHeight * 0.34, -spec.hullLength * 0.47);
	group.add(tail);

	return [
		addEngineBlock(
			group,
			engineMat,
			0,
			spec.hullHeight * 0.3,
			-spec.hullLength / 2 - 0.07,
			spec.hullWidth * 0.22,
			spec.hullHeight * 0.24,
			0.14,
		),
	];
};

const ENEMY_HULLS: Record<EnemyKind, HullBuilder> = {
	pursuer: buildDefaultEnemyHull,
	interceptor: buildDefaultEnemyHull,
	flanker: buildDefaultEnemyHull,
	orbiter: buildDefaultEnemyHull,
	brawler: buildBrawlerHull,
	gunship: buildGunshipHull,
	sniper: buildSniperHull,
};

export function enemyShipGroup(kind: EnemyKind): BuiltEnemy {
	const spec = ENEMY_SPECS[kind];
	const group = new Group();
	const hullMat = ENEMY_HULL_MATS[kind];
	const engineMat = createEngineMaterial(0xffaa66, 0xff6622);
	const engineMounts = ENEMY_HULLS[kind](group, spec, hullMat, engineMat);

	ENEMY_DETAILS[kind](group, hullMat);

	const turretMount = spec.turretMount
		? buildTurretMountGroup(spec.turretMount, spec.hullHeight, ENEMY_ACCENT_MAT)
		: null;
	if (turretMount) group.add(turretMount);

	return { group, turretMount, engineMaterial: engineMat, engineMounts };
}
