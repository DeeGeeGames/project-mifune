import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { ENGINE_PLUME_COLOR } from '../constants';
import type { ShipClass, ShipSpec } from './specs';
import { attachEnginePlume, engineSize, type EngineMount, type ShipMaterials } from './mounts';

const SIDES = [-1, 1] as const;

type ShipDetailBuilder = (group: Group, spec: ShipSpec, mats: ShipMaterials) => readonly EngineMount[];

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
	const engW = spec.hullWidth * 0.55;
	const engH = spec.hullHeight * 0.5;
	const engD = 0.12;
	const eng = new Mesh(new BoxGeometry(engW, engH, engD), mats.engine);
	eng.position.set(0, spec.hullHeight * 0.5, -spec.hullLength / 2 - 0.06);
	group.add(eng);
	return [attachEnginePlume(eng, engD, engineSize(engW, engH), ENGINE_PLUME_COLOR)];
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
	const engW = spec.hullWidth * 0.3;
	const engH = spec.hullHeight * 0.55;
	const engD = 0.14;
	return SIDES.map((side) => {
		const eng = new Mesh(new BoxGeometry(engW, engH, engD), mats.engine);
		eng.position.set(side * spec.hullWidth * 0.27, spec.hullHeight * 0.45, -spec.hullLength / 2 - 0.07);
		group.add(eng);
		return attachEnginePlume(eng, engD, engineSize(engW, engH), ENGINE_PLUME_COLOR);
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
	const engW = spec.hullWidth * 0.36;
	const engH = spec.hullHeight * 0.7;
	const engD = 0.18;
	return SIDES.map((side) => {
		const eng = new Mesh(new BoxGeometry(engW, engH, engD), mats.engine);
		eng.position.set(side * spec.hullWidth * 0.27, spec.hullHeight * 0.5, -spec.hullLength / 2 - 0.09);
		group.add(eng);
		return attachEnginePlume(eng, engD, engineSize(engW, engH), ENGINE_PLUME_COLOR);
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
	const engW = podWidth * 0.75;
	const engH = podHeight * 0.7;
	const engD = 0.18;
	const engineMounts = SIDES.map((side) => {
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
		const eng = new Mesh(new BoxGeometry(engW, engH, engD), mats.engine);
		eng.position.set(
			side * (spec.hullWidth / 2 + podWidth / 2),
			podHeight / 2,
			podZ - podLength / 2 - 0.09,
		);
		group.add(eng);
		return attachEnginePlume(eng, engD, engineSize(engW, engH), ENGINE_PLUME_COLOR);
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

	return engineMounts;
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

	const engW = spec.hullWidth * 0.35;
	const engH = spec.hullHeight * 0.55;
	const engD = 0.18;
	return SIDES.map((side) => {
		const eng = new Mesh(new BoxGeometry(engW, engH, engD), mats.engine);
		eng.position.set(side * spec.hullWidth * 0.3, spec.hullHeight * 0.5, -spec.hullLength / 2 - 0.09);
		group.add(eng);
		return attachEnginePlume(eng, engD, engineSize(engW, engH), ENGINE_PLUME_COLOR);
	});
};

export const SHIP_DETAILS: Record<ShipClass, ShipDetailBuilder> = {
	carrier: addCarrierDetails,
	corvette: addCorvetteDetails,
	frigate: addFrigateDetails,
	destroyer: addDestroyerDetails,
	dreadnought: addDreadnoughtDetails,
};
