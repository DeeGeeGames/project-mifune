import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial, Mesh } from 'three';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { definePlugin, type World, type LoadoutMode } from '../types';
import { wrapIndex, menuAxisDelta, renderMenuText } from '../menu';
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
import { degreesRounded, forwardXZ } from '../math';
import { ISO_AZIMUTH, ISO_ELEVATION, CAMERA_DISTANCE } from '../constants';
import { WEAPON_KINDS, WEAPON_LABELS, WEAPON_LABEL_WIDTH, PYLON_LABELS, PAIR_LABELS } from '../loadoutLabels';
import { renderStatCard } from './statCardDom';

const LOADOUT_AZIMUTH = -Math.PI / 5;
const LOADOUT_ELEVATION = Math.PI / 8;
const OVERHEAD_ZOOM = 1.8;
const GAMEPLAY_ZOOM = 1;

type MenuRow =
	| { kind: 'pylon'; pylonIdx: number }
	| { kind: 'pair'; pairIdx: number }
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

const MENU_HINT = '\n[←→] weapon   [↑↓] select   [A] configure / start';
const FACING_HINT = '\n[←→] facing   [A] confirm   [B] cancel';

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

const pylonConsumingPair = (loadout: CarrierLoadout, pylonIdx: number): CarrierLoadoutPair | null =>
	loadout.pairs.find((p) => p.weaponKind === 'mainGun' && (p.pylonA === pylonIdx || p.pylonB === pylonIdx)) ?? null;

const pairIsLocked = (loadout: CarrierLoadout, pair: CarrierLoadoutPair): boolean => {
	if (pair.weaponKind === 'mainGun') return false;
	const a = loadout.pylons[pair.pylonA];
	const b = loadout.pylons[pair.pylonB];
	return (a !== undefined && a.weaponKind !== null) || (b !== undefined && b.weaponKind !== null);
};

const buildMenuRows = (loadout: CarrierLoadout): readonly MenuRow[] => [
	...loadout.pylons.map((_, idx): MenuRow => ({ kind: 'pylon', pylonIdx: idx })),
	...loadout.pairs.map((_, idx): MenuRow => ({ kind: 'pair', pairIdx: idx })),
	{ kind: 'back' },
	{ kind: 'start' },
];

const renderPylonRow = (
	pylon: CarrierLoadoutPylon,
	pylonIdx: number,
	loadout: CarrierLoadout,
	isFacingFocus: boolean,
): string => {
	const label = PYLON_LABELS[pylonIdx] ?? `Pylon ${pylonIdx + 1}`;
	const consumingPair = pylonConsumingPair(loadout, pylonIdx);
	if (consumingPair) {
		const pairLabel = PAIR_LABELS[consumingPair.slot];
		const lockedText = `[Main Gun — ${pairLabel}]`.padEnd(WEAPON_LABEL_WIDTH + 20);
		return `${label}:   ${lockedText}`;
	}
	const weaponText = WEAPON_LABELS[pylon.weaponKind ?? 'none'].padEnd(WEAPON_LABEL_WIDTH);
	if (pylon.weaponKind === null) return `${label}: ◀ ${weaponText} ▶`;
	const facingText = formatFacingDeg(pylon.facing).padStart(5);
	const wrapped = isFacingFocus ? `◀ ${facingText} ▶` : `  ${facingText}  `;
	return `${label}: ◀ ${weaponText} ▶   ${wrapped}`;
};

const renderPairRow = (pair: CarrierLoadoutPair, loadout: CarrierLoadout): string => {
	const label = PAIR_LABELS[pair.slot];
	if (pair.weaponKind === 'mainGun') {
		return `${label}: ◀ ${WEAPON_LABELS.mainGun.padEnd(WEAPON_LABEL_WIDTH)} ▶`;
	}
	if (pairIsLocked(loadout, pair)) {
		const noneText = WEAPON_LABELS.none.padEnd(WEAPON_LABEL_WIDTH);
		return `${label}:   ${noneText}     [locked: pylons in use]`;
	}
	const noneText = WEAPON_LABELS.none.padEnd(WEAPON_LABEL_WIDTH);
	return `${label}: ◀ ${noneText} ▶`;
};

const renderRow = (
	row: MenuRow,
	loadout: CarrierLoadout,
	facingPylonIdx: number,
): string => {
	if (row.kind === 'back') return 'Back';
	if (row.kind === 'start') return 'Start Game';
	if (row.kind === 'pair') {
		const pair = loadout.pairs[row.pairIdx];
		if (!pair) return '';
		return renderPairRow(pair, loadout);
	}
	const pylon = loadout.pylons[row.pylonIdx];
	if (!pylon) return PYLON_LABELS[row.pylonIdx] ?? `Pylon ${row.pylonIdx + 1}`;
	return renderPylonRow(pylon, row.pylonIdx, loadout, row.pylonIdx === facingPylonIdx);
};

const renderRows = (
	rows: readonly MenuRow[],
	loadout: CarrierLoadout,
	selectedIdx: number,
	mode: LoadoutMode,
): string => {
	const facingIdx = mode.kind === 'facing' ? mode.pylonIdx : -1;
	const cursorIdx = mode.kind === 'facing' ? rows.findIndex((r) => r.kind === 'pylon' && r.pylonIdx === facingIdx) : selectedIdx;
	const body = renderMenuText(rows, cursorIdx, (row) => renderRow(row, loadout, facingIdx));
	return body + (mode.kind === 'facing' ? FACING_HINT : MENU_HINT);
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

type Focus =
	| { kind: 'none' }
	| { kind: 'pylon'; pylonIdx: number }
	| { kind: 'pair'; pairIdx: number };

const focusKey = (focus: Focus): string =>
	focus.kind === 'pylon' ? `pylon:${focus.pylonIdx}` : focus.kind === 'pair' ? `pair:${focus.pairIdx}` : 'none';

const focusFromState = (
	mode: LoadoutMode,
	rows: readonly MenuRow[],
	selectedIdx: number,
): Focus => {
	if (mode.kind === 'facing') return { kind: 'pylon', pylonIdx: mode.pylonIdx };
	const row = rows[selectedIdx];
	if (!row) return { kind: 'none' };
	if (row.kind === 'pylon') return { kind: 'pylon', pylonIdx: row.pylonIdx };
	if (row.kind === 'pair') return { kind: 'pair', pairIdx: row.pairIdx };
	return { kind: 'none' };
};

const focusStatCardKind = (focus: Focus, loadout: CarrierLoadout): WeaponKind | null => {
	if (focus.kind === 'pylon') return loadout.pylons[focus.pylonIdx]?.weaponKind ?? null;
	if (focus.kind === 'pair') return loadout.pairs[focus.pairIdx]?.weaponKind ?? null;
	return null;
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

const buildPreview = (
	ecs: World,
	loadout: CarrierLoadout,
	focus: Focus,
	showArcs: boolean,
): PreviewHandle => {
	const spec = SHIP_SPECS.carrier;
	const built = createShipGroup('carrier');
	buildCarrierLoadoutVisual(spec, built, loadout);
	const mounts = spec.emptyTurretMounts ?? [];
	if (showArcs && focus.kind === 'pylon') {
		const pylon = loadout.pylons[focus.pylonIdx];
		const mount = mounts[focus.pylonIdx];
		if (pylon && mount) built.group.add(buildPylonArcGroup(mount, pylon, true, spec.hullHeight));
	}
	const entity = ecs.spawn({
		...createGroupComponents(built.group, { x: 0, y: 0, z: 0 }, { rotation: { y: -Math.PI / 2 }, scale: 0.5 }),
	});
	return { carrierId: entity.id, group: built.group };
};

const applyWeaponCycle = (
	loadout: CarrierLoadout,
	pylonIdx: number,
	mount: EmptyTurretMount,
	dir: 1 | -1,
): boolean => {
	const pylon = loadout.pylons[pylonIdx];
	if (!pylon) return false;
	if (pylonConsumingPair(loadout, pylonIdx)) return false;
	const nextKind = cycleWeapon(pylon.weaponKind, dir);
	if ((pylon.weaponKind === null) !== (nextKind === null)) pylon.facing = mount.baseAngle;
	pylon.weaponKind = nextKind;
	return true;
};

const applyPairWeaponCycle = (pair: CarrierLoadoutPair, loadout: CarrierLoadout): boolean => {
	if (pair.weaponKind === 'mainGun') {
		pair.weaponKind = null;
		return true;
	}
	if (pairIsLocked(loadout, pair)) return false;
	pair.weaponKind = 'mainGun';
	return true;
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
		let lastFocusKey = 'init';
		let lastModeKind: LoadoutMode['kind'] | null = null;
		let lastRenderedText = '';
		let lastStatCardKind: WeaponKind | null = null;

		world.eventBus.subscribe('screenEnter', ({ screen }) => {
			if (screen !== 'loadoutSelect') return;
			const hudRefs = world.getResource('hudRefs');
			hudRefs.loadoutEl.style.display = 'flex';

			const camera = world.getResource('camera3DState');
			camera.unfollow();
			camera.setTarget(0, 0, 0);
			camera.setOrbit(LOADOUT_AZIMUTH, LOADOUT_ELEVATION, CAMERA_DISTANCE);
			if (camera.projection === 'orthographic') camera.setZoom(OVERHEAD_ZOOM);

			const loadout = world.getResource('carrierLoadout');
			const state = world.getScreenState('loadoutSelect');
			state.mode = { kind: 'menu' };
			const rows = buildMenuRows(loadout);
			state.selectedIndex = Math.min(state.selectedIndex, rows.length - 1);

			const focus = focusFromState(state.mode, rows, state.selectedIndex);
			preview = buildPreview(world, loadout, focus, false);
			dirty = false;
			lastFocusKey = focusKey(focus);
			lastModeKind = state.mode.kind;
			lastRenderedText = renderRows(rows, loadout, state.selectedIndex, state.mode);
			hudRefs.loadoutMenuEl.textContent = lastRenderedText;
			lastStatCardKind = focusStatCardKind(focus, loadout);
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

				const dx = menuAxisDelta(inputState, 'menuLeft', 'menuRight');
				const dy = menuAxisDelta(inputState, 'menuUp', 'menuDown');

				if (state.mode.kind === 'menu') {
					if (dy !== 0) state.selectedIndex = wrapIndex(state.selectedIndex + dy, rows.length);

					const row = rows[state.selectedIndex];

					if (dx !== 0 && row) {
						if (row.kind === 'pylon') {
							const focusedMount = emptyMounts[row.pylonIdx];
							if (focusedMount && applyWeaponCycle(carrierLoadout, row.pylonIdx, focusedMount, dx)) dirty = true;
						} else if (row.kind === 'pair') {
							const focusedPair = carrierLoadout.pairs[row.pairIdx];
							if (focusedPair && applyPairWeaponCycle(focusedPair, carrierLoadout)) dirty = true;
						}
					}

					if (inputState.actions.justActivated('menuConfirm')) {
						if (row?.kind === 'back') { void ecs.setScreen('title', {}); return; }
						if (row?.kind === 'start') { void ecs.setScreen('playing', { waveNumber: 1 }); return; }
						if (row?.kind === 'pylon') {
							const focusedPylon = carrierLoadout.pylons[row.pylonIdx];
							if (
								focusedPylon &&
								focusedPylon.weaponKind !== null &&
								!pylonConsumingPair(carrierLoadout, row.pylonIdx)
							) {
								state.mode = { kind: 'facing', pylonIdx: row.pylonIdx, initialFacing: focusedPylon.facing };
							}
						}
					}
				} else {
					const pylonIdx = state.mode.pylonIdx;
					const focusedPylon = carrierLoadout.pylons[pylonIdx];
					const focusedMount = emptyMounts[pylonIdx];
					if (!focusedPylon || !focusedMount || focusedPylon.weaponKind === null) {
						state.mode = { kind: 'menu' };
					} else {
						if (dx !== 0) {
							applyFacingStep(focusedPylon, focusedMount, dx);
							dirty = true;
						}
						if (inputState.actions.justActivated('menuConfirm')) {
							const pylonRowIdx = rows.findIndex((r) => r.kind === 'pylon' && r.pylonIdx === pylonIdx);
							if (pylonRowIdx >= 0) state.selectedIndex = pylonRowIdx;
							state.mode = { kind: 'menu' };
						} else if (inputState.actions.justActivated('menuCancel')) {
							focusedPylon.facing = state.mode.initialFacing;
							const pylonRowIdx = rows.findIndex((r) => r.kind === 'pylon' && r.pylonIdx === pylonIdx);
							if (pylonRowIdx >= 0) state.selectedIndex = pylonRowIdx;
							state.mode = { kind: 'menu' };
							dirty = true;
						}
					}
				}

				const focus = focusFromState(state.mode, rows, state.selectedIndex);
				const nextFocusKey = focusKey(focus);
				if (dirty || nextFocusKey !== lastFocusKey || state.mode.kind !== lastModeKind) {
					tearDownPreview(ecs, preview);
					preview = buildPreview(ecs, carrierLoadout, focus, state.mode.kind === 'facing');
					lastFocusKey = nextFocusKey;
					lastModeKind = state.mode.kind;
					dirty = false;
				}

				const text = renderRows(rows, carrierLoadout, state.selectedIndex, state.mode);
				if (text !== lastRenderedText) {
					hudRefs.loadoutMenuEl.textContent = text;
					lastRenderedText = text;
				}

				const kind = focusStatCardKind(focus, carrierLoadout);
				if (kind !== lastStatCardKind) {
					renderStatCard(hudRefs.loadoutStatCardEl, kind);
					lastStatCardKind = kind;
				}
			});
	},
});
