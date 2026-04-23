import { BoxGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SHIP_DETAILS } from './details';
import type { ShipClass } from './specs';
import { SHIP_SPECS } from './specs';
import {
	buildAuxMountGroup,
	buildBeamMountGroup,
	buildEmptyMountGroup,
	buildMissileMountGroup,
	buildTurretMountGroup,
	createEngineMaterial,
	type BeamMountBuild,
	type EngineMount,
	type ShipMaterials,
} from './mounts';

export interface BuiltShip {
	readonly group: Group;
	readonly turretMounts: readonly Group[];
	readonly cannonTurretMounts: readonly Group[];
	readonly beamTurretMounts: readonly BeamMountBuild[];
	readonly missileTurretMounts: readonly Group[];
	readonly emptyTurretMountGroups: readonly Group[];
	readonly emptyAuxMountGroups: readonly Group[];
	readonly engineMaterial: MeshStandardMaterial;
	readonly engineMounts: readonly EngineMount[];
}

export function createShipGroup(shipClass: ShipClass): BuiltShip {
	const spec = SHIP_SPECS[shipClass];
	const group = new Group();

	const mats: ShipMaterials = {
		hull: new MeshStandardMaterial({ color: spec.color, roughness: 0.55, metalness: 0.25 }),
		accent: new MeshStandardMaterial({ color: 0x222833, roughness: 0.6, metalness: 0.2 }),
		engine: createEngineMaterial(0x88ccff, 0x4488ff),
	};

	const hullGeo = spec.flatBow
		? new RoundedBoxGeometry(spec.hullWidth, spec.hullHeight, spec.hullLength, 4, Math.min(spec.hullWidth, spec.hullHeight) * 0.45)
		: new BoxGeometry(spec.hullWidth, spec.hullHeight, spec.hullLength);
	const hull = new Mesh(hullGeo, mats.hull);
	hull.position.y = spec.hullHeight / 2;
	group.add(hull);

	if (!spec.flatBow) {
		const bow = new Mesh(new ConeGeometry(spec.hullWidth * 0.55, spec.hullLength * 0.35, 12), mats.hull);
		bow.position.set(0, spec.hullHeight / 2, spec.hullLength / 2 + spec.hullLength * 0.17);
		bow.rotation.x = Math.PI / 2;
		group.add(bow);
	}

	const engineMounts = SHIP_DETAILS[shipClass](group, spec, mats);

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

	const emptyAuxMountGroups: Group[] = (spec.auxiliaryMounts ?? []).map((mount) => {
		const auxGroup = buildAuxMountGroup(mount, spec, mats.accent);
		group.add(auxGroup);
		return auxGroup;
	});

	return {
		group,
		turretMounts,
		cannonTurretMounts,
		beamTurretMounts,
		missileTurretMounts,
		emptyTurretMountGroups,
		emptyAuxMountGroups,
		engineMaterial: mats.engine,
		engineMounts,
	};
}
