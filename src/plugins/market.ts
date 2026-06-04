import { definePlugin, type World } from '../types';
import { wrapIndex, menuAxisDelta, menuCursor } from '../menu';
import {
	rollOffers,
	rerollCost,
	offerLabel,
	offerCanPurchase,
	offerOnPurchase,
	hasEmptyPylon,
	hasEmptyAuxSlot,
	emptyAuxSlotIndices,
	type ShopOffer,
} from '../shop';
import { SHIP_SPECS, pylonsConsumedByPairs } from '../ships';
import { PYLON_LABELS, AUX_SLOT_LABELS } from '../loadoutLabels';
import { MARKET_OFFER_COUNT } from '../constants';
import {
	renderMarketGrid,
	renderMarketFooter,
	gridLeftRight,
	type FooterAction,
} from './marketCardsDom';
import { renderStatCard, renderAuxStatCard } from './statCardDom';
import { setScreenLegend, dpadVertical, dpadHorizontal, type LegendSpec } from './legend';

const LEGEND_BROWSE: readonly LegendSpec[] = [
	dpadVertical('Navigate'),
	dpadHorizontal(''),
	{ action: 'menuConfirm', label: 'Confirm' },
];

const LEGEND_ASSIGN_PYLON: readonly LegendSpec[] = [
	dpadVertical('Pick pylon'),
	{ action: 'menuConfirm', label: 'Assign' },
	{ action: 'menuCancel',  label: 'Cancel' },
];

const LEGEND_ASSIGN_AUX: readonly LegendSpec[] = [
	dpadVertical('Pick aux slot'),
	{ action: 'menuConfirm', label: 'Assign' },
	{ action: 'menuCancel',  label: 'Cancel' },
];

type PylonAssignRow =
	| { kind: 'pylon'; pylonIdx: number }
	| { kind: 'cancel' };

type AuxAssignRow =
	| { kind: 'aux'; auxIdx: number }
	| { kind: 'cancel' };

const emptyPylonIndices = (world: World): readonly number[] => {
	const loadout = world.getResource('carrierLoadout');
	const consumed = pylonsConsumedByPairs(loadout);
	return loadout.pylons
		.map((pylon, idx) => ({ pylon, idx }))
		.filter(({ pylon, idx }) => pylon.weaponKind === null && !consumed.has(idx))
		.map(({ idx }) => idx);
};

const buildAssignPylonRows = (world: World): readonly PylonAssignRow[] => [
	...emptyPylonIndices(world).map((pylonIdx): PylonAssignRow => ({ kind: 'pylon', pylonIdx })),
	{ kind: 'cancel' },
];

const buildAssignAuxRows = (world: World): readonly AuxAssignRow[] => [
	...emptyAuxSlotIndices(world).map((auxIdx): AuxAssignRow => ({ kind: 'aux', auxIdx })),
	{ kind: 'cancel' },
];

const pylonRowLabel = (row: PylonAssignRow): string =>
	row.kind === 'cancel' ? 'Cancel' : (PYLON_LABELS[row.pylonIdx] ?? `Pylon ${row.pylonIdx + 1}`);

const auxRowLabel = (row: AuxAssignRow): string =>
	row.kind === 'cancel' ? 'Cancel' : (AUX_SLOT_LABELS[row.auxIdx] ?? `Aux ${row.auxIdx + 1}`);

const renderAssign = (
	el: HTMLElement,
	rowLabels: readonly string[],
	selectedIndex: number,
	header: string,
): void => {
	const lines = rowLabels.map((label, idx) => menuCursor(idx === selectedIndex) + label).join('\n');
	el.textContent = header + lines;
};

const offerFocusKey = (offer: ShopOffer | undefined): string => {
	if (!offer) return '';
	return offer.payload.kind === 'weapon'
		? `weapon:${offer.payload.weaponKind}`
		: `aux:${offer.payload.auxKind}`;
};

const renderOfferStatCard = (el: HTMLElement, offer: ShopOffer | undefined, emptyMessage: string): void => {
	if (!offer) { renderStatCard(el, null, emptyMessage); return; }
	if (offer.payload.kind === 'weapon') renderStatCard(el, offer.payload.weaponKind, emptyMessage);
	else renderAuxStatCard(el, offer.payload.auxKind);
};

const confirmBrowse = (world: World, offerIdx: number): void => {
	const state = world.getScreenState('market');
	const offer = state.offers[offerIdx];
	if (!offer || offer.sold) return;
	const playerState = world.getResource('playerState');
	if (offer.cost > playerState.resources) return;
	if (!offerCanPurchase(offer, world)) return;
	const followUp = offerOnPurchase(offer, world);
	if (followUp.status === 'complete') {
		playerState.resources -= offer.cost;
		offer.sold = true;
		return;
	}
	state.mode = followUp.assignment === 'pylon'
		? { kind: 'assignPylon', offerIdx }
		: { kind: 'assignAux',   offerIdx };
	state.selectedIndex = 0;
};

const confirmReroll = (world: World): void => {
	const state = world.getScreenState('market');
	const playerState = world.getResource('playerState');
	const cost = rerollCost(state.waveNumber, state.rerollCount);
	if (playerState.resources < cost) return;
	playerState.resources -= cost;
	state.rerollCount += 1;
	state.offers = rollOffers(world, MARKET_OFFER_COUNT, Math.random);
};

const confirmContinue = (world: World): void => {
	const state = world.getScreenState('market');
	void world.setScreen('homeBase', {
		nextWaveNumber: state.nextWaveNumber,
		...(state.lastMissionResult ? { lastMissionResult: state.lastMissionResult } : {}),
	});
};

const resetToBrowse = (world: World, offerIdx: number): void => {
	const state = world.getScreenState('market');
	state.mode = { kind: 'browse' };
	state.selectedIndex = offerIdx;
};

const confirmAssignPylon = (world: World, rows: readonly PylonAssignRow[]): void => {
	const state = world.getScreenState('market');
	if (state.mode.kind !== 'assignPylon') return;
	const row = rows[state.selectedIndex];
	if (!row) return;
	const offerIdx = state.mode.offerIdx;
	const offer = state.offers[offerIdx];
	if (row.kind === 'cancel' || !offer || offer.payload.kind !== 'weapon') {
		resetToBrowse(world, offerIdx);
		return;
	}
	const loadout = world.getResource('carrierLoadout');
	const pylon = loadout.pylons[row.pylonIdx];
	const mount = (SHIP_SPECS.carrier.emptyTurretMounts ?? [])[row.pylonIdx];
	if (!pylon || !mount) {
		resetToBrowse(world, offerIdx);
		return;
	}
	pylon.weaponKind = offer.payload.weaponKind;
	pylon.facing = mount.baseAngle;
	const playerState = world.getResource('playerState');
	playerState.resources -= offer.cost;
	offer.sold = true;
	resetToBrowse(world, offerIdx);
};

const confirmAssignAux = (world: World, rows: readonly AuxAssignRow[]): void => {
	const state = world.getScreenState('market');
	if (state.mode.kind !== 'assignAux') return;
	const row = rows[state.selectedIndex];
	if (!row) return;
	const offerIdx = state.mode.offerIdx;
	const offer = state.offers[offerIdx];
	if (row.kind === 'cancel' || !offer || offer.payload.kind !== 'aux') {
		resetToBrowse(world, offerIdx);
		return;
	}
	const loadout = world.getResource('carrierLoadout');
	const slot = loadout.auxSlots[row.auxIdx];
	if (!slot) {
		resetToBrowse(world, offerIdx);
		return;
	}
	slot.systemKind = offer.payload.auxKind;
	const playerState = world.getResource('playerState');
	playerState.resources -= offer.cost;
	offer.sold = true;
	resetToBrowse(world, offerIdx);
};

const totalBrowseRows = (offerCount: number): number => offerCount + 2;
const rerollIndex = (offerCount: number): number => offerCount;
const continueIndex = (offerCount: number): number => offerCount + 1;

const offerFingerprint = (offer: ShopOffer): string => {
	const id = offer.payload.kind === 'weapon' ? `w:${offer.payload.weaponKind}` : `a:${offer.payload.auxKind}`;
	return `${id}:${offer.cost}:${offer.sold ? 's' : 'a'}`;
};

const gridKey = (
	offers: readonly ShopOffer[],
	selectedIdx: number,
	resources: number,
	hasEmptyPylon: boolean,
	hasEmptyAux: boolean,
): string =>
	`${selectedIdx}|${resources}|${hasEmptyPylon ? 1 : 0}|${hasEmptyAux ? 1 : 0}|${offers.map(offerFingerprint).join(',')}`;

const footerKey = (selectedIdx: number, cost: number, resources: number): string =>
	`${selectedIdx}|${cost}|${resources}`;

const legendForMode = (mode: 'browse' | 'assignPylon' | 'assignAux'): readonly LegendSpec[] => {
	if (mode === 'browse') return LEGEND_BROWSE;
	if (mode === 'assignPylon') return LEGEND_ASSIGN_PYLON;
	return LEGEND_ASSIGN_AUX;
};

export const createMarketPlugin = () => definePlugin({
	id: 'market',
	install: (world) => {
		let lastGridKey = '';
		let lastFooterKey = '';
		let lastStatCardKey = '';
		let lastAssignText = '';
		let lastMode: 'browse' | 'assignPylon' | 'assignAux' | null = null;

		const setBrowseVisibility = (visible: boolean) => {
			const hudRefs = world.getResource('hudRefs');
			hudRefs.marketGridEl.style.display = visible ? '' : 'none';
			hudRefs.marketFooterEl.style.display = visible ? '' : 'none';
			hudRefs.marketAssignEl.style.display = visible ? 'none' : '';
		};

		const confirmByIndex = (offerCount: number, idx: number) => {
			if (idx < offerCount) { confirmBrowse(world, idx); return; }
			if (idx === rerollIndex(offerCount)) { confirmReroll(world); return; }
			if (idx === continueIndex(offerCount)) { confirmContinue(world); return; }
		};

		const handleFooterAction = (action: FooterAction, offerCount: number) => {
			const state = world.getScreenState('market');
			if (action === 'reroll') {
				state.selectedIndex = rerollIndex(offerCount);
				confirmReroll(world);
			} else {
				state.selectedIndex = continueIndex(offerCount);
				confirmContinue(world);
			}
		};

		const resetCaches = () => {
			lastGridKey = '';
			lastFooterKey = '';
			lastStatCardKey = '';
			lastAssignText = '';
			lastMode = null;
		};

		world.onScreenEnter('market', () => {
			const hudRefs = world.getResource('hudRefs');
			hudRefs.marketEl.style.display = 'flex';
			const state = world.getScreenState('market');
			state.offers = rollOffers(world, MARKET_OFFER_COUNT, Math.random);
			state.rerollCount = 0;
			state.mode = { kind: 'browse' };
			state.selectedIndex = 0;
			hudRefs.marketTitleEl.textContent = state.lastMissionResult
				? `MARKET — WAVE ${state.waveNumber} COMPLETE`
				: 'MARKET — HOME BASE';
			resetCaches();
			setBrowseVisibility(true);
			setScreenLegend(world, 'market', LEGEND_BROWSE);
		});

		world.onScreenExit('market', () => {
			world.getResource('hudRefs').marketEl.style.display = 'none';
		});

		world.addSystem('market-input')
			.setPriority(100)
			.inPhase('update')
			.inScreens(['market'])
			.withResources(['inputState'])
			.setProcess(({ ecs, resources: { inputState } }) => {
				const state = ecs.getScreenState('market');
				const offerCount = state.offers.length;

				if (state.mode.kind === 'browse') {
					const total = totalBrowseRows(offerCount);
					const dy = menuAxisDelta(inputState, 'menuUp', 'menuDown');
					if (dy !== 0) state.selectedIndex = wrapIndex(state.selectedIndex + dy, total);
					const dx = menuAxisDelta(inputState, 'menuLeft', 'menuRight');
					if (dx !== 0) state.selectedIndex = gridLeftRight(offerCount, state.selectedIndex, dx);
					if (inputState.actions.justActivated('menuConfirm')) {
						confirmByIndex(offerCount, state.selectedIndex);
					}
					return;
				}
				if (state.mode.kind === 'assignPylon') {
					const rows = buildAssignPylonRows(ecs);
					const dy = menuAxisDelta(inputState, 'menuUp', 'menuDown');
					if (rows.length > 0) {
						state.selectedIndex = dy !== 0
							? wrapIndex(state.selectedIndex + dy, rows.length)
							: Math.min(state.selectedIndex, rows.length - 1);
					}
					if (inputState.actions.justActivated('menuConfirm')) confirmAssignPylon(ecs, rows);
					if (inputState.actions.justActivated('menuCancel')) resetToBrowse(ecs, state.mode.offerIdx);
					return;
				}
				const rows = buildAssignAuxRows(ecs);
				const dy = menuAxisDelta(inputState, 'menuUp', 'menuDown');
				if (rows.length > 0) {
					state.selectedIndex = dy !== 0
						? wrapIndex(state.selectedIndex + dy, rows.length)
						: Math.min(state.selectedIndex, rows.length - 1);
				}
				if (inputState.actions.justActivated('menuConfirm')) confirmAssignAux(ecs, rows);
				if (inputState.actions.justActivated('menuCancel')) resetToBrowse(ecs, state.mode.offerIdx);
			});

		world.addSystem('market-render')
			.setPriority(100)
			.inPhase('render')
			.inScreens(['market'])
			.withResources(['hudRefs', 'playerState'])
			.setProcess(({ ecs, resources: { hudRefs, playerState } }) => {
				const state = ecs.getScreenState('market');
				const offerCount = state.offers.length;
				const mode = state.mode.kind;
				if (mode !== lastMode) {
					setBrowseVisibility(mode === 'browse');
					setScreenLegend(ecs, 'market', legendForMode(mode));
					lastMode = mode;
				}
				hudRefs.marketResourcesEl.textContent = `Resources: ${playerState.resources}`;

				if (mode === 'browse') {
					const emptyPylon = hasEmptyPylon(ecs);
					const emptyAux = hasEmptyAuxSlot(ecs);
					const selectedIdx = state.selectedIndex;
					const gk = gridKey(state.offers, selectedIdx, playerState.resources, emptyPylon, emptyAux);
					if (gk !== lastGridKey) {
						renderMarketGrid(
							hudRefs.marketGridEl,
							state.offers,
							selectedIdx,
							{ resources: playerState.resources, hasEmptyPylon: emptyPylon, hasEmptyAuxSlot: emptyAux },
							(offerIdx) => {
								state.selectedIndex = offerIdx;
								confirmByIndex(offerCount, offerIdx);
							},
						);
						lastGridKey = gk;
					}
					const rCost = rerollCost(state.waveNumber, state.rerollCount);
					const fk = footerKey(selectedIdx, rCost, playerState.resources);
					if (fk !== lastFooterKey) {
						renderMarketFooter(
							hudRefs.marketFooterEl,
							rerollIndex(offerCount),
							continueIndex(offerCount),
							selectedIdx,
							{ rerollCost: rCost, resources: playerState.resources },
							(action) => handleFooterAction(action, offerCount),
						);
						lastFooterKey = fk;
					}
					const focusedOffer = selectedIdx < offerCount ? state.offers[selectedIdx] : undefined;
					const fkStr = offerFocusKey(focusedOffer);
					if (fkStr !== lastStatCardKey) {
						renderOfferStatCard(hudRefs.marketStatCardEl, focusedOffer, '— hover an offer —');
						lastStatCardKey = fkStr;
					}
					return;
				}
				if (state.mode.kind === 'assignPylon') {
					const offerIdx = state.mode.offerIdx;
					const offer = state.offers[offerIdx];
					if (!offer) return;
					const rows = buildAssignPylonRows(ecs);
					const assignText = `p|${offerIdx}|${state.selectedIndex}|${rows.length}|${offer.cost}`;
					if (assignText !== lastAssignText) {
						const header = `Assign ${offerLabel(offer)} (${offer.cost} res) to pylon:\n\n`;
						renderAssign(hudRefs.marketAssignEl, rows.map(pylonRowLabel), state.selectedIndex, header);
						lastAssignText = assignText;
					}
					const fkStr = offerFocusKey(offer);
					if (fkStr !== lastStatCardKey) {
						renderOfferStatCard(hudRefs.marketStatCardEl, offer, '');
						lastStatCardKey = fkStr;
					}
					return;
				}
				if (state.mode.kind !== 'assignAux') return;
				const offerIdx = state.mode.offerIdx;
				const offer = state.offers[offerIdx];
				if (!offer) return;
				const rows = buildAssignAuxRows(ecs);
				const assignText = `a|${offerIdx}|${state.selectedIndex}|${rows.length}|${offer.cost}`;
				if (assignText !== lastAssignText) {
					const header = `Install ${offerLabel(offer)} (${offer.cost} res) in aux slot:\n\n`;
					renderAssign(hudRefs.marketAssignEl, rows.map(auxRowLabel), state.selectedIndex, header);
					lastAssignText = assignText;
				}
				const fkStr = offerFocusKey(offer);
				if (fkStr !== lastStatCardKey) {
					renderOfferStatCard(hudRefs.marketStatCardEl, offer, '');
					lastStatCardKey = fkStr;
				}
			});
	},
});
