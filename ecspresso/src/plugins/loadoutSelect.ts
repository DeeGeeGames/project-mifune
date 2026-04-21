import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial, Mesh } from 'three';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { definePlugin, type World } from '../types';
import { menuAxisDelta, wrapIndex } from '../menu';
import {
	SHIP_SPECS,
	createShipGroup,
	buildCarrierLoadoutVisual,
	pylonArc,
	type EmptyTurretMount,
	type CarrierLoadout,
	type CarrierLoadoutPylon,
	type CarrierLoadoutPair,
	type WeaponKind,
} from '../ships';
import { angleDiff, clamp, forwardXZ, normalizeAngle } from '../math';
import { ISO_AZIMUTH, ISO_ELEVATION, CAMERA_DISTANCE, LOADOUT_CARRIER_ROTATION_SMOOTHING } from '../constants';
import { WEAPON_KINDS } from '../loadoutLabels';
import { renderStatCard } from './statCardDom';

const LOADOUT_AZIMUTH = -Math.PI / 5;
const LOADOUT_ELEVATION = Math.PI / 8;
const OVERHEAD_ZOOM = 1.8;
const GAMEPLAY_ZOOM = 1;

// World bearing of the camera as seen from the carrier in the loadout scene.
// camera3D positions the eye at (sin(az), _, cos(az)) * distance, so the
// camera-side direction in XZ is the azimuth itself. Rotating the carrier so a
// pylon at local (mx, mz) lies along that bearing requires
// ry = LOADOUT_AZIMUTH - atan2(mx, mz).
const CAMERA_FOREGROUND_BEARING = LOADOUT_AZIMUTH;

const CARRIER_MOUNTS: readonly EmptyTurretMount[] = SHIP_SPECS.carrier.emptyTurretMounts ?? [];

// Clockwise loop around the ship (viewed from above, bow up). Right advances, Left retreats.
const NEXT_PYLON: readonly number[] = [3, 0, 1, 4, 5, 2];
const PREV_PYLON: readonly number[] = [1, 2, 5, 0, 3, 4];

const WEAPON_CYCLE: readonly (WeaponKind | null)[] = [null, ...WEAPON_KINDS];

const FACING_STEP = Math.PI / 4;
const FACING_EPS = 1e-6;

const ARC_LINE_LEN = 2.4;
const ARC_Y_OFFSET = 0.2;
const ARC_DIM_COLOR = 0x4a5870;
const ARC_BRIGHT_COLOR = 0xffd55a;
const FACING_DIM_COLOR = 0x6aa5ff;
const FACING_BRIGHT_COLOR = 0xffee66;

const pylonConsumingPair = (loadout: CarrierLoadout, pylonIdx: number): CarrierLoadoutPair | null =>
	loadout.pairs.find((p) => p.weaponKind === 'mainGun' && (p.pylonA === pylonIdx || p.pylonB === pylonIdx)) ?? null;

const pairSlotForEdge = (loadout: CarrierLoadout, a: number, b: number): CarrierLoadoutPair | null =>
	loadout.pairs.find((p) => (p.pylonA === a && p.pylonB === b) || (p.pylonA === b && p.pylonB === a)) ?? null;

const effectiveWeapon = (loadout: CarrierLoadout, pylonIdx: number): WeaponKind | null => {
	if (pylonConsumingPair(loadout, pylonIdx)) return 'mainGun';
	return loadout.pylons[pylonIdx]?.weaponKind ?? null;
};

const arcIntersection = (
	a: EmptyTurretMount,
	b: EmptyTurretMount,
): { readonly min: number; readonly max: number } | null => {
	const ra = pylonArc(a);
	const rb = pylonArc(b);
	const min = Math.max(ra.min, rb.min);
	const max = Math.min(ra.max, rb.max);
	return max >= min - FACING_EPS ? { min, max } : null;
};

const rightNeighborClear = (loadout: CarrierLoadout, pylonIdx: number): boolean => {
	const neighborIdx = NEXT_PYLON[pylonIdx];
	if (neighborIdx === undefined) return false;
	const neighbor = loadout.pylons[neighborIdx];
	if (!neighbor) return false;
	if (neighbor.weaponKind !== null) return false;
	return !pylonConsumingPair(loadout, neighborIdx);
};

const availableWeaponCycle = (loadout: CarrierLoadout, pylonIdx: number): readonly (WeaponKind | null)[] => {
	const current = effectiveWeapon(loadout, pylonIdx);
	if (current === 'mainGun') return [...WEAPON_CYCLE, 'mainGun'];
	if (rightNeighborClear(loadout, pylonIdx)) return [...WEAPON_CYCLE, 'mainGun'];
	return WEAPON_CYCLE;
};

const stepFacing = (current: number, dir: 1 | -1, min: number, max: number): number => {
	const next = current + dir * FACING_STEP;
	if (next > max + FACING_EPS) return min;
	if (next < min - FACING_EPS) return max;
	return clamp(next, min, max);
};

const applyWeaponCycle = (
	loadout: CarrierLoadout,
	pylonIdx: number,
	dir: 1 | -1,
): boolean => {
	const mount = CARRIER_MOUNTS[pylonIdx];
	const pylon = loadout.pylons[pylonIdx];
	if (!mount || !pylon) return false;

	const options = availableWeaponCycle(loadout, pylonIdx);
	const current = effectiveWeapon(loadout, pylonIdx);
	const idx = options.indexOf(current);
	const startIdx = idx < 0 ? 0 : idx;
	const next = options[wrapIndex(startIdx + dir, options.length)] ?? null;
	if (next === current) return false;

	const enteringMainGun = next === 'mainGun';
	const exitingMainGun = current === 'mainGun';
	const prevNull = current === null;
	const nextNull = next === null;

	if (exitingMainGun) {
		const neighborIdx = NEXT_PYLON[pylonIdx] ?? -1;
		const pair = pairSlotForEdge(loadout, pylonIdx, neighborIdx);
		if (pair) pair.weaponKind = null;
	}

	if (enteringMainGun) {
		const neighborIdx = NEXT_PYLON[pylonIdx] ?? -1;
		const neighbor = loadout.pylons[neighborIdx];
		const neighborMount = CARRIER_MOUNTS[neighborIdx];
		const pair = pairSlotForEdge(loadout, pylonIdx, neighborIdx);
		if (!neighbor || !neighborMount || !pair) return false;
		pylon.weaponKind = null;
		neighbor.weaponKind = null;
		pair.weaponKind = 'mainGun';
		const intersect = arcIntersection(mount, neighborMount);
		if (intersect) {
			const aimed = clamp(pylon.facing, intersect.min, intersect.max);
			pylon.facing = aimed;
			neighbor.facing = aimed;
		} else {
			pylon.facing = mount.baseAngle;
			neighbor.facing = neighborMount.baseAngle;
		}
		return true;
	}

	pylon.weaponKind = next;
	if (prevNull !== nextNull) pylon.facing = mount.baseAngle;
	return true;
};

const applyFacingStep = (
	loadout: CarrierLoadout,
	pylonIdx: number,
	dir: 1 | -1,
): boolean => {
	const mount = CARRIER_MOUNTS[pylonIdx];
	const pylon = loadout.pylons[pylonIdx];
	if (!mount || !pylon) return false;

	const consumingPair = pylonConsumingPair(loadout, pylonIdx);
	if (consumingPair) {
		const otherIdx = consumingPair.pylonA === pylonIdx ? consumingPair.pylonB : consumingPair.pylonA;
		const otherMount = CARRIER_MOUNTS[otherIdx];
		const other = loadout.pylons[otherIdx];
		if (!otherMount || !other) return false;
		const intersect = arcIntersection(mount, otherMount);
		if (!intersect) return false;
		if (intersect.max - intersect.min < FACING_EPS) return false;
		const nextFacing = stepFacing(pylon.facing, dir, intersect.min, intersect.max);
		pylon.facing = nextFacing;
		other.facing = nextFacing;
		return true;
	}

	if (pylon.weaponKind === null) return false;
	const arc = pylonArc(mount);
	pylon.facing = stepFacing(pylon.facing, dir, arc.min, arc.max);
	return true;
};

const buildArcLine = (angle: number, length: number, color: number, yOffset: number): Line => {
	const fwd = forwardXZ(angle);
	const positions = new Float32Array([0, yOffset, 0, fwd.x * length, yOffset, fwd.z * length]);
	const geo = new BufferGeometry();
	geo.setAttribute('position', new BufferAttribute(positions, 3));
	return new Line(geo, new LineBasicMaterial({ color }));
};

const buildPylonArcGroup = (
	mount: EmptyTurretMount,
	pylon: CarrierLoadoutPylon,
	bright: boolean,
	hullHeight: number,
): Group => {
	const { min, max } = pylonArc(mount);
	const group = new Group();
	group.position.set(mount.x, hullHeight + ARC_Y_OFFSET, mount.z);
	const arcColor = bright ? ARC_BRIGHT_COLOR : ARC_DIM_COLOR;
	const facingColor = bright ? FACING_BRIGHT_COLOR : FACING_DIM_COLOR;
	group.add(buildArcLine(min, ARC_LINE_LEN, arcColor, 0));
	group.add(buildArcLine(max, ARC_LINE_LEN, arcColor, 0));
	group.add(buildArcLine(pylon.facing, ARC_LINE_LEN * 0.95, facingColor, 0.02));
	return group;
};

const targetRyForPylon = (pylonIdx: number, fallback: number): number => {
	const m = CARRIER_MOUNTS[pylonIdx];
	return m ? CAMERA_FOREGROUND_BEARING - Math.atan2(m.x, m.z) : fallback;
};

interface PreviewHandle {
	readonly carrierId: number;
	readonly group: Group;
}

const disposePreviewGraph = (root: Group): void => {
	root.traverse((obj) => {
		const mesh = obj as Partial<Mesh> & Partial<Line>;
		if (mesh.geometry && !mesh.geometry.userData.shared) mesh.geometry.dispose();
		const mat = mesh.material;
		if (!mat) return;
		(Array.isArray(mat) ? mat : [mat]).forEach((m) => {
			if (!m.userData.shared) m.dispose();
		});
	});
};

const tearDownPreview = (ecs: World, handle: PreviewHandle | null): void => {
	if (!handle) return;
	ecs.removeEntity(handle.carrierId);
	disposePreviewGraph(handle.group);
};

const pylonIndicesToHighlight = (loadout: CarrierLoadout, selectedIdx: number): readonly number[] => {
	const consumingPair = pylonConsumingPair(loadout, selectedIdx);
	if (!consumingPair) return [selectedIdx];
	return [consumingPair.pylonA, consumingPair.pylonB];
};

const buildPreview = (
	ecs: World,
	loadout: CarrierLoadout,
	selectedIdx: number,
	initialRy: number,
): PreviewHandle => {
	const spec = SHIP_SPECS.carrier;
	const built = createShipGroup('carrier');
	buildCarrierLoadoutVisual(spec, built, loadout);
	pylonIndicesToHighlight(loadout, selectedIdx).forEach((idx) => {
		const pylon = loadout.pylons[idx];
		const mount = CARRIER_MOUNTS[idx];
		if (pylon && mount) built.group.add(buildPylonArcGroup(mount, pylon, true, spec.hullHeight));
	});
	const entity = ecs.spawn({
		...createGroupComponents(built.group, { x: 0, y: 0, z: 0 }, { rotation: { y: initialRy }, scale: 0.5 }),
	});
	return { carrierId: entity.id, group: built.group };
};

const snapshotLoadout = (loadout: CarrierLoadout): string => {
	const pylons = loadout.pylons.map((p) => `${p.weaponKind ?? '_'}@${p.facing.toFixed(3)}`).join('|');
	const pairs = loadout.pairs.map((p) => `${p.slot}:${p.weaponKind ?? '_'}`).join('|');
	return `${pylons}#${pairs}`;
};

export const createLoadoutSelectPlugin = () => definePlugin({
	id: 'loadoutSelect',
	install: (world) => {
		let preview: PreviewHandle | null = null;
		let lastSelectedIdx = -1;
		let lastSnapshot = '';
		let lastStatCardKind: WeaponKind | null = null;
		let previewRy = 0;
		let targetRy = 0;

		world.eventBus.subscribe('screenEnter', ({ screen }) => {
			if (screen !== 'loadoutSelect') return;
			const hudRefs = world.getResource('hudRefs');
			hudRefs.loadoutEl.style.display = 'block';

			const camera = world.getResource('camera3DState');
			camera.unfollow();
			camera.setTarget(0, 0, 0);
			camera.setOrbit(LOADOUT_AZIMUTH, LOADOUT_ELEVATION, CAMERA_DISTANCE);
			if (camera.projection === 'orthographic') camera.setZoom(OVERHEAD_ZOOM);

			const loadout = world.getResource('carrierLoadout');
			const state = world.getScreenState('loadoutSelect');
			state.selectedPylonIdx = clamp(state.selectedPylonIdx, 0, CARRIER_MOUNTS.length - 1);

			targetRy = targetRyForPylon(state.selectedPylonIdx, 0);
			previewRy = targetRy;
			preview = buildPreview(world, loadout, state.selectedPylonIdx, previewRy);
			lastSelectedIdx = state.selectedPylonIdx;
			lastSnapshot = snapshotLoadout(loadout);
			lastStatCardKind = effectiveWeapon(loadout, state.selectedPylonIdx);
			renderStatCard(hudRefs.loadoutStatCardEl, lastStatCardKind);
		});

		world.eventBus.subscribe('screenExit', ({ screen }) => {
			if (screen !== 'loadoutSelect') return;
			const hudRefs = world.getResource('hudRefs');
			hudRefs.loadoutEl.style.display = 'none';
			tearDownPreview(world, preview);
			preview = null;
			const camera = world.getResource('camera3DState');
			camera.setOrbit(ISO_AZIMUTH, ISO_ELEVATION, CAMERA_DISTANCE);
			if (camera.projection === 'orthographic') camera.setZoom(GAMEPLAY_ZOOM);
		});

		world.addSystem('loadout-input')
			.setPriority(100)
			.inPhase('update')
			.inScreens(['loadoutSelect'])
			.withResources(['inputState', 'hudRefs', 'carrierLoadout'])
			.setProcess(({ ecs, resources: { inputState, hudRefs, carrierLoadout } }) => {
				const state = ecs.getScreenState('loadoutSelect');

				if (inputState.actions.justActivated('menuConfirm')) {
					void ecs.setScreen('playing', { waveNumber: 1 });
					return;
				}
				if (inputState.actions.justActivated('menuCancel')) {
					void ecs.setScreen('title', {});
					return;
				}

				const dx = menuAxisDelta(inputState, 'menuLeft', 'menuRight');
				if (dx > 0) state.selectedPylonIdx = NEXT_PYLON[state.selectedPylonIdx] ?? state.selectedPylonIdx;
				else if (dx < 0) state.selectedPylonIdx = PREV_PYLON[state.selectedPylonIdx] ?? state.selectedPylonIdx;

				const dy = menuAxisDelta(inputState, 'menuUp', 'menuDown');
				if (dy !== 0) applyWeaponCycle(carrierLoadout, state.selectedPylonIdx, dy);

				const facingDir: 1 | -1 | 0 =
					inputState.actions.justActivated('facingCW') ? 1
					: inputState.actions.justActivated('facingCCW') ? -1
					: 0;
				if (facingDir !== 0) applyFacingStep(carrierLoadout, state.selectedPylonIdx, facingDir);

				targetRy = targetRyForPylon(state.selectedPylonIdx, targetRy);

				const snapshot = snapshotLoadout(carrierLoadout);
				const changed = snapshot !== lastSnapshot || state.selectedPylonIdx !== lastSelectedIdx;
				if (changed) {
					tearDownPreview(ecs, preview);
					preview = buildPreview(ecs, carrierLoadout, state.selectedPylonIdx, previewRy);
					lastSelectedIdx = state.selectedPylonIdx;
					lastSnapshot = snapshot;
				}

				const kind = effectiveWeapon(carrierLoadout, state.selectedPylonIdx);
				if (kind !== lastStatCardKind) {
					renderStatCard(hudRefs.loadoutStatCardEl, kind);
					lastStatCardKind = kind;
				}
			});

		world.addSystem('loadout-carrier-rotation')
			.setPriority(150)
			.inPhase('update')
			.inScreens(['loadoutSelect'])
			.setProcess(({ ecs, dt }) => {
				if (!preview) return;
				const k = clamp(LOADOUT_CARRIER_ROTATION_SMOOTHING * dt, 0, 1);
				previewRy = normalizeAngle(previewRy + angleDiff(targetRy, previewRy) * k);
				const transform = ecs.getComponent(preview.carrierId, 'localTransform3D');
				if (!transform) return;
				transform.ry = previewRy;
				ecs.markChanged(preview.carrierId, 'localTransform3D');
			});
	},
});
