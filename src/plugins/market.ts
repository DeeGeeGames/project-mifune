import { definePlugin, type World } from '../types';
import { wrapIndex, menuAxisDelta, menuCursor } from '../menu';
import {
	rollOffers,
	rerollCost,
	offerLabel,
	offerCanPurchase,
	offerOnPurchase,
	type ShopOffer,
} from '../shop';
import { SHIP_SPECS, pylonsConsumedByPairs, type WeaponKind } from '../ships';
import { PYLON_LABELS } from '../loadoutLabels';
import { MARKET_OFFER_COUNT } from '../constants';
import {
	renderMarketGrid,
	renderMarketFooter,
	gridLeftRight,
	type FooterAction,
} from './marketCardsDom';
import { renderStatCard } from './statCardDom';
import { setScreenLegend, dpadVertical, dpadHorizontal, type LegendSpec } from './legend';

const LEGEND_BROWSE: readonly LegendSpec[] = [
	dpadVertical('Navigate'),
	dpadHorizontal(''),
	{ action: 'menuConfirm', label: 'Confirm' },
];

const LEGEND_ASSIGN: readonly LegendSpec[] = [
	dpadVertical('Pick pylon'),
	{ action: 'menuConfirm', label: 'Assign' },
	{ action: 'menuCancel',  label: 'Cancel' },
];

type AssignRow =
	| { kind: 'pylon'; pylonIdx: number }
	| { kind: 'cancel' };

const emptyPylonIndices = (world: World): readonly number[] => {
	const loadout = world.getResource('carrierLoadout');
	const consumed = pylonsConsumedByPairs(loadout);
	return loadout.pylons
		.map((pylon, idx) => ({ pylon, idx }))
		.filter(({ pylon, idx }) => pylon.weaponKind === null && !consumed.has(idx))
		.map(({ idx }) => idx);
};

const buildAssignRows = (world: World): readonly AssignRow[] => [
	...emptyPylonIndices(world).map((pylonIdx): AssignRow => ({ kind: 'pylon', pylonIdx })),
	{ kind: 'cancel' },
];

const assignRowLabel = (row: AssignRow): string =>
	row.kind === 'cancel' ? 'Cancel' : (PYLON_LABELS[row.pylonIdx] ?? `Pylon ${row.pylonIdx + 1}`);

const renderAssign = (
	el: HTMLElement,
	rows: readonly AssignRow[],
	selectedIndex: number,
	offer: ShopOffer,
): void => {
	const header = `Assign ${offerLabel(offer)} (${offer.cost} res) to pylon:\n\n`;
	const lines = rows.map((row, idx) => menuCursor(idx === selectedIndex) + assignRowLabel(row)).join('\n');
	el.textContent = header + lines;
};

const offerWeaponKind = (offer: ShopOffer | undefined): WeaponKind | null =>
	offer && offer.payload.kind === 'weapon' ? offer.payload.weaponKind : null;

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
	state.mode = { kind: 'assignPylon', offerIdx };
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
	void world.setScreen('playing', { waveNumber: state.waveNumber + 1 });
};

const confirmAssign = (world: World, rows: readonly AssignRow[]): void => {
	const state = world.getScreenState('market');
	if (state.mode.kind !== 'assignPylon') return;
	const row = rows[state.selectedIndex];
	if (!row) return;
	const offerIdx = state.mode.offerIdx;
	const offer = state.offers[offerIdx];
	const resetToBrowse = () => {
		state.mode = { kind: 'browse' };
		state.selectedIndex = offerIdx;
	};
	if (row.kind === 'cancel' || !offer || offer.payload.kind !== 'weapon') {
		resetToBrowse();
		return;
	}
	const loadout = world.getResource('carrierLoadout');
	const pylon = loadout.pylons[row.pylonIdx];
	const mount = (SHIP_SPECS.carrier.emptyTurretMounts ?? [])[row.pylonIdx];
	if (!pylon || !mount) {
		resetToBrowse();
		return;
	}
	pylon.weaponKind = offer.payload.weaponKind;
	pylon.facing = mount.baseAngle;
	const playerState = world.getResource('playerState');
	playerState.resources -= offer.cost;
	offer.sold = true;
	resetToBrowse();
};

const totalBrowseRows = (offerCount: number): number => offerCount + 2;
const rerollIndex = (offerCount: number): number => offerCount;
const continueIndex = (offerCount: number): number => offerCount + 1;

const offerFingerprint = (offer: ShopOffer): string => {
	const id = offer.payload.kind === 'weapon' ? offer.payload.weaponKind : offer.payload.kind;
	return `${id}:${offer.cost}:${offer.sold ? 's' : 'a'}`;
};

const gridKey = (offers: readonly ShopOffer[], selectedIdx: number, resources: number, hasEmpty: boolean): string =>
	`${selectedIdx}|${resources}|${hasEmpty ? 1 : 0}|${offers.map(offerFingerprint).join(',')}`;

const footerKey = (selectedIdx: number, cost: number, resources: number, nextWave: number): string =>
	`${selectedIdx}|${cost}|${resources}|${nextWave}`;

export const createMarketPlugin = () => definePlugin({
	id: 'market',
	install: (world) => {
		let lastGridKey = '';
		let lastFooterKey = '';
		let lastStatCardKind: WeaponKind | null = null;
		let lastAssignText = '';
		let lastMode: 'browse' | 'assignPylon' | null = null;

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
			lastStatCardKind = null;
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
			hudRefs.marketTitleEl.textContent = `MARKET — WAVE ${state.waveNumber} COMPLETE`;
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
				const assignRows = buildAssignRows(ecs);
				const dy = menuAxisDelta(inputState, 'menuUp', 'menuDown');
				if (assignRows.length > 0) {
					state.selectedIndex = dy !== 0
						? wrapIndex(state.selectedIndex + dy, assignRows.length)
						: Math.min(state.selectedIndex, assignRows.length - 1);
				}
				if (inputState.actions.justActivated('menuConfirm')) confirmAssign(ecs, assignRows);
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
					setScreenLegend(ecs, 'market', mode === 'browse' ? LEGEND_BROWSE : LEGEND_ASSIGN);
					lastMode = mode;
				}
				hudRefs.marketResourcesEl.textContent = `Resources: ${playerState.resources}`;

				if (mode === 'browse') {
					const hasEmptyPylon = emptyPylonIndices(ecs).length > 0;
					const selectedIdx = state.selectedIndex;
					const gk = gridKey(state.offers, selectedIdx, playerState.resources, hasEmptyPylon);
					if (gk !== lastGridKey) {
						renderMarketGrid(
							hudRefs.marketGridEl,
							state.offers,
							selectedIdx,
							{ resources: playerState.resources, hasEmptyPylon },
							(offerIdx) => {
								state.selectedIndex = offerIdx;
								confirmByIndex(offerCount, offerIdx);
							},
						);
						lastGridKey = gk;
					}
					const rCost = rerollCost(state.waveNumber, state.rerollCount);
					const fk = footerKey(selectedIdx, rCost, playerState.resources, state.waveNumber + 1);
					if (fk !== lastFooterKey) {
						renderMarketFooter(
							hudRefs.marketFooterEl,
							rerollIndex(offerCount),
							continueIndex(offerCount),
							selectedIdx,
							{ rerollCost: rCost, resources: playerState.resources, nextWaveNumber: state.waveNumber + 1 },
							(action) => handleFooterAction(action, offerCount),
						);
						lastFooterKey = fk;
					}
					const focusedOffer = selectedIdx < offerCount ? state.offers[selectedIdx] : undefined;
					const kind = offerWeaponKind(focusedOffer);
					if (kind !== lastStatCardKind) {
						renderStatCard(hudRefs.marketStatCardEl, kind, '— hover an offer —');
						lastStatCardKind = kind;
					}
					return;
				}
				if (state.mode.kind !== 'assignPylon') return;
				const offerIdx = state.mode.offerIdx;
				const offer = state.offers[offerIdx];
				const assignRows = buildAssignRows(ecs);
				if (!offer) return;
				const assignText = `${offerIdx}|${state.selectedIndex}|${assignRows.length}|${offer.cost}`;
				if (assignText !== lastAssignText) {
					renderAssign(hudRefs.marketAssignEl, assignRows, state.selectedIndex, offer);
					lastAssignText = assignText;
				}
				const kind = offerWeaponKind(offer);
				if (kind !== lastStatCardKind) {
					renderStatCard(hudRefs.marketStatCardEl, kind, '');
					lastStatCardKind = kind;
				}
			});
	},
});
