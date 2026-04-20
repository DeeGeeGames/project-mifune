import { definePlugin, type World } from '../types';
import { wrapIndex, menuAxisDelta, renderMenuText } from '../menu';
import {
	rollOffers,
	rerollCost,
	offerLabel,
	offerCanPurchase,
	offerOnPurchase,
	type ShopOffer,
} from '../shop';
import { SHIP_SPECS } from '../ships';
import { PYLON_LABELS } from '../loadoutLabels';
import { MARKET_OFFER_COUNT } from '../constants';

type BrowseRow =
	| { kind: 'offer'; offerIdx: number }
	| { kind: 'reroll' }
	| { kind: 'continue' };

type AssignRow =
	| { kind: 'pylon'; pylonIdx: number }
	| { kind: 'cancel' };

const buildBrowseRows = (offers: readonly ShopOffer[]): readonly BrowseRow[] => [
	...offers.map((_, offerIdx): BrowseRow => ({ kind: 'offer', offerIdx })),
	{ kind: 'reroll' },
	{ kind: 'continue' },
];

const emptyPylonIndices = (world: World): readonly number[] =>
	world.getResource('carrierLoadout').pylons
		.map((pylon, idx) => ({ pylon, idx }))
		.filter(({ pylon }) => pylon.weaponKind === null)
		.map(({ idx }) => idx);

const buildAssignRows = (world: World): readonly AssignRow[] => [
	...emptyPylonIndices(world).map((pylonIdx): AssignRow => ({ kind: 'pylon', pylonIdx })),
	{ kind: 'cancel' },
];

interface BrowseContext {
	readonly offers: readonly ShopOffer[];
	readonly resources: number;
	readonly rerollCostNow: number;
	readonly waveNumber: number;
	readonly hasEmptyPylon: boolean;
}

const offerStatus = (offer: ShopOffer, ctx: BrowseContext): string => {
	if (offer.sold) return 'SOLD';
	if (!ctx.hasEmptyPylon) return 'NO PYLON';
	if (offer.cost > ctx.resources) return 'NEED RES';
	return '';
};

const renderOfferRow = (offer: ShopOffer, ctx: BrowseContext): string => {
	const status = offerStatus(offer, ctx);
	const statusText = status === '' ? '' : `  [${status}]`;
	return `${offerLabel(offer).padEnd(14)} — ${String(offer.cost).padStart(4)} res${statusText}`;
};

const browseRowLabel = (row: BrowseRow, ctx: BrowseContext): string => {
	if (row.kind === 'offer') {
		const offer = ctx.offers[row.offerIdx];
		return offer ? renderOfferRow(offer, ctx) : '?';
	}
	if (row.kind === 'reroll') {
		const afford = ctx.resources >= ctx.rerollCostNow ? '' : '  [NEED RES]';
		return `Re-roll        — ${String(ctx.rerollCostNow).padStart(4)} res${afford}`;
	}
	return `Continue to Wave ${ctx.waveNumber + 1}`;
};

const renderBrowse = (
	rows: readonly BrowseRow[],
	selectedIndex: number,
	ctx: BrowseContext,
): string => `Resources: ${ctx.resources}\n\n${renderMenuText(rows, selectedIndex, (row) => browseRowLabel(row, ctx))}`;

const assignRowLabel = (row: AssignRow): string =>
	row.kind === 'cancel' ? 'Cancel' : (PYLON_LABELS[row.pylonIdx] ?? `Pylon ${row.pylonIdx + 1}`);

const renderAssign = (
	rows: readonly AssignRow[],
	selectedIndex: number,
	offer: ShopOffer,
): string => `Assign ${offerLabel(offer)} (${offer.cost} res) to pylon:\n\n${renderMenuText(rows, selectedIndex, assignRowLabel)}`;

const confirmBrowse = (world: World, rows: readonly BrowseRow[]): void => {
	const state = world.getScreenState('market');
	const row = rows[state.selectedIndex];
	if (!row) return;
	if (row.kind === 'continue') {
		void world.setScreen('playing', { waveNumber: state.waveNumber + 1 });
		return;
	}
	const playerState = world.getResource('playerState');
	if (row.kind === 'reroll') {
		const cost = rerollCost(state.waveNumber, state.rerollCount);
		if (playerState.resources < cost) return;
		playerState.resources -= cost;
		state.rerollCount += 1;
		state.offers = rollOffers(world, MARKET_OFFER_COUNT, Math.random);
		return;
	}
	const offer = state.offers[row.offerIdx];
	if (!offer || offer.sold) return;
	if (offer.cost > playerState.resources) return;
	if (!offerCanPurchase(offer, world)) return;
	const followUp = offerOnPurchase(offer, world);
	if (followUp.status === 'complete') {
		playerState.resources -= offer.cost;
		offer.sold = true;
		return;
	}
	state.mode = { kind: 'assignPylon', offerIdx: row.offerIdx };
	state.selectedIndex = 0;
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

export const createMarketPlugin = () => definePlugin({
	id: 'market',
	install: (world) => {
		let lastRenderedText = '';

		world.eventBus.subscribe('screenEnter', ({ screen }) => {
			if (screen !== 'market') return;
			const hudRefs = world.getResource('hudRefs');
			hudRefs.marketEl.style.display = 'flex';
			const state = world.getScreenState('market');
			state.offers = rollOffers(world, MARKET_OFFER_COUNT, Math.random);
			state.rerollCount = 0;
			state.mode = { kind: 'browse' };
			state.selectedIndex = 0;
			hudRefs.marketTitleEl.textContent = `MARKET — WAVE ${state.waveNumber} COMPLETE`;
			lastRenderedText = '';
		});

		world.eventBus.subscribe('screenExit', ({ screen }) => {
			if (screen !== 'market') return;
			world.getResource('hudRefs').marketEl.style.display = 'none';
		});

		world.addSystem('market-menu')
			.setPriority(100)
			.inPhase('update')
			.inScreens(['market'])
			.withResources(['inputState', 'hudRefs', 'playerState', 'carrierLoadout'])
			.setProcess(({ ecs, resources: { inputState, hudRefs, playerState, carrierLoadout } }) => {
				const state = ecs.getScreenState('market');

				const browseRows = state.mode.kind === 'browse' ? buildBrowseRows(state.offers) : null;
				const assignRows = state.mode.kind === 'assignPylon' ? buildAssignRows(ecs) : null;
				const rowCount = browseRows?.length ?? assignRows?.length ?? 0;

				const delta = menuAxisDelta(inputState, 'menuUp', 'menuDown');
				if (delta !== 0 && rowCount > 0) {
					state.selectedIndex = wrapIndex(state.selectedIndex + delta, rowCount);
				}

				if (inputState.actions.justActivated('menuConfirm')) {
					if (browseRows) confirmBrowse(ecs, browseRows);
					else if (assignRows) confirmAssign(ecs, assignRows);
				}

				const text = browseRows
					? renderBrowse(browseRows, state.selectedIndex, {
						offers: state.offers,
						resources: playerState.resources,
						rerollCostNow: rerollCost(state.waveNumber, state.rerollCount),
						waveNumber: state.waveNumber,
						hasEmptyPylon: carrierLoadout.pylons.some((p) => p.weaponKind === null),
					})
					: assignRows && state.mode.kind === 'assignPylon'
						? (() => {
							const offer = state.offers[state.mode.offerIdx];
							return offer ? renderAssign(assignRows, state.selectedIndex, offer) : '';
						})()
						: '';

				if (text !== lastRenderedText) {
					hudRefs.marketMenuEl.textContent = text;
					lastRenderedText = text;
				}
			});
	},
});
