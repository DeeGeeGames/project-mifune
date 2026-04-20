import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial, Mesh } from 'three';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { definePlugin, type World } from '../types';
import { wrapIndex, menuAxisDelta, menuCursor } from '../menu';
import {
	SHIP_SPECS,
	createShipGroup,
	buildCarrierLoadoutVisual,
	pylonArc,
	type EmptyTurretMount,
	type CarrierLoadout,
	type CarrierLoadoutPylon,
	type WeaponKind,
} from '../ships';
import { degreesRounded, forwardXZ } from '../math';
import { ISO_AZIMUTH, ISO_ELEVATION, CAMERA_DISTANCE } from '../constants';
import { WEAPON_KINDS, WEAPON_LABELS, WEAPON_LABEL_WIDTH, PYLON_LABELS } from '../loadoutLabels';
import { renderStatCard } from './statCardDom';

const OVERHEAD_ELEVATION = Math.PI / 2 - 0.0001;
const OVERHEAD_ZOOM = 1.8;
const GAMEPLAY_ZOOM = 1;

type MenuRow =
	| { kind: 'pylon'; pylonIdx: number }
	| { kind: 'back' }
	| { kind: 'start' };

const WEAPON_CYCLE: readonly (WeaponKind | null)[] = [null, ...WEAPON_KINDS];

const FACING_STEP = Math.PI / 4;
const FACING_EPS = 1e-6;

const ARC_LINE_LEN = 2.4;
const ARC_Y_OFFSET = 0.2;
const ARC_DIM_COLOR = 0x4a5870;
const ARC_BRIGHT_COLOR = 0xffd55a;
const FACING_DIM_COLOR = 0x6aa5ff;
const FACING_BRIGHT_COLOR = 0xffee66;

const cycleWeapon = (current: WeaponKind | null, dir: 1 | -1): WeaponKind | null => {
	const idx = WEAPON_CYCLE.indexOf(current);
	return WEAPON_CYCLE[wrapIndex((idx < 0 ? 0 : idx) + dir, WEAPON_CYCLE.length)] ?? null;
};

const stepFacing = (current: number, dir: 1 | -1, min: number, max: number): number => {
	const next = current + dir * FACING_STEP;
	if (next > max + FACING_EPS) return min;
	if (next < min - FACING_EPS) return max;
	return next;
};

const formatFacingDeg = (rad: number): string => `${degreesRounded(rad)}°`;

const buildMenuRows = (loadout: CarrierLoadout): readonly MenuRow[] => [
	...loadout.pylons.map((_, idx): MenuRow => ({ kind: 'pylon', pylonIdx: idx })),
	{ kind: 'back' },
	{ kind: 'start' },
];

const renderPylonRow = (pylon: CarrierLoadoutPylon, pylonIdx: number): string => {
	const label = PYLON_LABELS[pylonIdx] ?? `Pylon ${pylonIdx + 1}`;
	const weaponText = WEAPON_LABELS[pylon.weaponKind ?? 'none'].padEnd(WEAPON_LABEL_WIDTH);
	if (pylon.weaponKind === null) return `${label}: ◀ ${weaponText} ▶`;
	return `${label}: ◀ ${weaponText} ▶   ${formatFacingDeg(pylon.facing).padStart(5)}`;
};

const renderRow = (row: MenuRow, loadout: CarrierLoadout): string => {
	if (row.kind === 'back') return 'Back';
	if (row.kind === 'start') return 'Start Game';
	const pylon = loadout.pylons[row.pylonIdx];
	if (!pylon) return PYLON_LABELS[row.pylonIdx] ?? `Pylon ${row.pylonIdx + 1}`;
	return renderPylonRow(pylon, row.pylonIdx);
};

const renderRows = (rows: readonly MenuRow[], loadout: CarrierLoadout, selectedIdx: number): string =>
	rows.map((row, idx) => menuCursor(idx === selectedIdx) + renderRow(row, loadout)).join('\n');

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
	isSelected: boolean,
	hullHeight: number,
): Group => {
	const { min, max } = pylonArc(mount);
	const group = new Group();
	group.position.set(mount.x, hullHeight + ARC_Y_OFFSET, mount.z);
	const arcColor = isSelected ? ARC_BRIGHT_COLOR : ARC_DIM_COLOR;
	const facingColor = isSelected ? FACING_BRIGHT_COLOR : FACING_DIM_COLOR;
	group.add(buildArcLine(min, ARC_LINE_LEN, arcColor, 0));
	group.add(buildArcLine(max, ARC_LINE_LEN, arcColor, 0));
	group.add(buildArcLine(pylon.facing, ARC_LINE_LEN * 0.95, facingColor, 0.02));
	return group;
};

const selectedPylonFromRow = (rows: readonly MenuRow[], selectedIdx: number): number => {
	const row = rows[selectedIdx];
	return row?.kind === 'pylon' ? row.pylonIdx : -1;
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

const buildPreview = (ecs: World, loadout: CarrierLoadout, selectedPylonIdx: number): PreviewHandle => {
	const spec = SHIP_SPECS.carrier;
	const built = createShipGroup('carrier');
	buildCarrierLoadoutVisual(spec, built, loadout);
	const mounts = spec.emptyTurretMounts ?? [];
	loadout.pylons.forEach((pylon, idx) => {
		const mount = mounts[idx];
		if (mount) built.group.add(buildPylonArcGroup(mount, pylon, idx === selectedPylonIdx, spec.hullHeight));
	});
	const entity = ecs.spawn({
		...createGroupComponents(built.group, { x: 0, y: 0, z: 0 }, { rotation: { y: -Math.PI / 2 }, scale: 0.5 }),
	});
	return { carrierId: entity.id, group: built.group };
};

const applyWeaponCycle = (pylon: CarrierLoadoutPylon, mount: EmptyTurretMount, dir: 1 | -1): void => {
	const nextKind = cycleWeapon(pylon.weaponKind, dir);
	if ((pylon.weaponKind === null) !== (nextKind === null)) pylon.facing = mount.baseAngle;
	pylon.weaponKind = nextKind;
};

const applyFacingStep = (pylon: CarrierLoadoutPylon, mount: EmptyTurretMount, dir: 1 | -1): void => {
	if (pylon.weaponKind === null) return;
	const arc = pylonArc(mount);
	pylon.facing = stepFacing(pylon.facing, dir, arc.min, arc.max);
};

export const createLoadoutSelectPlugin = () => definePlugin({
	id: 'loadoutSelect',
	install: (world) => {
		let preview: PreviewHandle | null = null;
		let dirty = false;
		let lastSelectedPylon = -2;
		let lastRenderedText = '';
		let lastStatCardKind: WeaponKind | null = null;

		const pylonWeaponKind = (loadout: CarrierLoadout, pylonIdx: number): WeaponKind | null =>
			pylonIdx >= 0 ? (loadout.pylons[pylonIdx]?.weaponKind ?? null) : null;

		world.eventBus.subscribe('screenEnter', ({ screen }) => {
			if (screen !== 'loadoutSelect') return;
			const hudRefs = world.getResource('hudRefs');
			hudRefs.loadoutEl.style.display = 'flex';

			const camera = world.getResource('camera3DState');
			camera.unfollow();
			camera.setTarget(0, 0, 0);
			camera.setOrbit(0, OVERHEAD_ELEVATION, CAMERA_DISTANCE);
			if (camera.projection === 'orthographic') camera.setZoom(OVERHEAD_ZOOM);

			const loadout = world.getResource('carrierLoadout');
			const state = world.getScreenState('loadoutSelect');
			const rows = buildMenuRows(loadout);
			state.selectedIndex = Math.min(state.selectedIndex, rows.length - 1);

			lastSelectedPylon = selectedPylonFromRow(rows, state.selectedIndex);
			preview = buildPreview(world, loadout, lastSelectedPylon);
			dirty = false;
			lastRenderedText = renderRows(rows, loadout, state.selectedIndex);
			hudRefs.loadoutMenuEl.textContent = lastRenderedText;
			lastStatCardKind = pylonWeaponKind(loadout, lastSelectedPylon);
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

		world.addSystem('loadout-menu')
			.setPriority(100)
			.inPhase('update')
			.inScreens(['loadoutSelect'])
			.withResources(['inputState', 'hudRefs', 'carrierLoadout'])
			.setProcess(({ ecs, resources: { inputState, hudRefs, carrierLoadout } }) => {
				const state = ecs.getScreenState('loadoutSelect');
				const emptyMounts = SHIP_SPECS.carrier.emptyTurretMounts ?? [];

				const rows = buildMenuRows(carrierLoadout);
				state.selectedIndex = Math.min(state.selectedIndex, rows.length - 1);

				const dy = menuAxisDelta(inputState, 'menuUp', 'menuDown');
				if (dy !== 0) state.selectedIndex = wrapIndex(state.selectedIndex + dy, rows.length);

				const row = rows[state.selectedIndex];
				const pylonIdx = row?.kind === 'pylon' ? row.pylonIdx : -1;
				const focusedPylon = pylonIdx >= 0 ? carrierLoadout.pylons[pylonIdx] : undefined;
				const focusedMount = pylonIdx >= 0 ? emptyMounts[pylonIdx] : undefined;

				const dx = menuAxisDelta(inputState, 'menuLeft', 'menuRight');
				if (dx !== 0 && focusedPylon && focusedMount) {
					if (inputState.actions.isActive('aimGate')) applyFacingStep(focusedPylon, focusedMount, dx);
					else applyWeaponCycle(focusedPylon, focusedMount, dx);
					dirty = true;
				}

				const dFacing = menuAxisDelta(inputState, 'pylonFacingLeft', 'pylonFacingRight');
				if (dFacing !== 0 && focusedPylon && focusedMount) {
					applyFacingStep(focusedPylon, focusedMount, dFacing);
					dirty = true;
				}

				if (inputState.actions.justActivated('menuConfirm')) {
					const row = rows[state.selectedIndex];
					if (row?.kind === 'back') { void ecs.setScreen('title', {}); return; }
					if (row?.kind === 'start') { void ecs.setScreen('playing', { waveNumber: 1 }); return; }
				}

				const selectedPylon = selectedPylonFromRow(rows, state.selectedIndex);
				if (dirty || selectedPylon !== lastSelectedPylon) {
					tearDownPreview(ecs, preview);
					preview = buildPreview(ecs, carrierLoadout, selectedPylon);
					lastSelectedPylon = selectedPylon;
					dirty = false;
				}

				const text = renderRows(rows, carrierLoadout, state.selectedIndex);
				if (text !== lastRenderedText) {
					hudRefs.loadoutMenuEl.textContent = text;
					lastRenderedText = text;
				}

				const kind = pylonWeaponKind(carrierLoadout, selectedPylon);
				if (kind !== lastStatCardKind) {
					renderStatCard(hudRefs.loadoutStatCardEl, kind);
					lastStatCardKind = kind;
				}
			});
	},
});
