import type { ShopOffer } from '../shop';
import { offerLabel } from '../shop';
import { weaponStats } from '../weaponStats';
import { buildLabeledRow } from './statCardDom';

export type OfferStatus = 'available' | 'sold' | 'noPylon' | 'needRes';

export interface MarketGridContext {
	readonly resources: number;
	readonly hasEmptyPylon: boolean;
}

export interface MarketFooterContext {
	readonly rerollCost: number;
	readonly resources: number;
	readonly nextWaveNumber: number;
}

export type FooterAction = 'reroll' | 'continue';

export const MARKET_GRID_COLS = 2;

const STATUS_LABELS: Record<OfferStatus, string> = {
	available: '',
	sold: 'SOLD',
	noPylon: 'NO PYLON',
	needRes: 'NEED RES',
};

const offerStatus = (offer: ShopOffer, ctx: MarketGridContext): OfferStatus => {
	if (offer.sold) return 'sold';
	if (offer.payload.kind === 'weapon' && !ctx.hasEmptyPylon) return 'noPylon';
	if (offer.cost > ctx.resources) return 'needRes';
	return 'available';
};

const STAT_KEYS: ReadonlySet<string> = new Set(['Damage', 'Range']);

const offerSummaryStats = (offer: ShopOffer): readonly { label: string; value: string }[] =>
	offer.payload.kind !== 'weapon'
		? []
		: weaponStats(offer.payload.weaponKind).filter((row) => STAT_KEYS.has(row.label));

const buildCardHeader = (name: string, suffix: string): HTMLElement => {
	const header = document.createElement('div');
	header.className = 'market-card-header';
	const nameEl = document.createElement('span');
	nameEl.className = 'market-card-name';
	nameEl.textContent = name;
	const suffixEl = document.createElement('span');
	suffixEl.className = 'market-card-cost';
	suffixEl.textContent = suffix;
	header.append(nameEl, suffixEl);
	return header;
};

const cardClasses = (isSelected: boolean, status: OfferStatus): string => {
	const classes = ['market-card'];
	if (isSelected) classes.push('market-card--selected');
	if (status === 'sold') classes.push('market-card--sold');
	else if (status !== 'available') classes.push('market-card--locked');
	return classes.join(' ');
};

const buildCard = (
	offer: ShopOffer,
	offerIdx: number,
	selectedIdx: number,
	ctx: MarketGridContext,
	onClick: (offerIdx: number) => void,
): HTMLElement => {
	const card = document.createElement('div');
	const status = offerStatus(offer, ctx);
	card.className = cardClasses(offerIdx === selectedIdx, status);

	const statusEl = document.createElement('div');
	statusEl.className = 'market-card-status';
	statusEl.textContent = STATUS_LABELS[status];

	card.append(buildCardHeader(offerLabel(offer), `${offer.cost} res`), statusEl);
	offerSummaryStats(offer).forEach(({ label, value }) =>
		card.append(buildLabeledRow('market-card-stat', label, value)),
	);

	card.addEventListener('click', () => onClick(offerIdx));
	return card;
};

export const renderMarketGrid = (
	gridEl: HTMLElement,
	offers: readonly ShopOffer[],
	selectedIdx: number,
	ctx: MarketGridContext,
	onSelect: (offerIdx: number) => void,
): void => {
	const cards = offers.map((offer, idx) => buildCard(offer, idx, selectedIdx, ctx, onSelect));
	gridEl.replaceChildren(...cards);
};

const buildFooterRow = (
	label: string,
	suffix: string,
	isSelected: boolean,
	isLocked: boolean,
	onClick: () => void,
): HTMLElement => {
	const row = document.createElement('div');
	const classes = ['market-card'];
	if (isSelected) classes.push('market-card--selected');
	if (isLocked) classes.push('market-card--locked');
	row.className = classes.join(' ');
	row.append(buildCardHeader(label, suffix));
	row.addEventListener('click', onClick);
	return row;
};

export const renderMarketFooter = (
	footerEl: HTMLElement,
	rerollIdx: number,
	continueIdx: number,
	selectedIdx: number,
	ctx: MarketFooterContext,
	onAction: (action: FooterAction) => void,
): void => {
	const reroll = buildFooterRow(
		'Re-roll Offers',
		`${ctx.rerollCost} res`,
		selectedIdx === rerollIdx,
		ctx.resources < ctx.rerollCost,
		() => onAction('reroll'),
	);
	const cont = buildFooterRow(
		`Continue to Wave ${ctx.nextWaveNumber}`,
		'',
		selectedIdx === continueIdx,
		false,
		() => onAction('continue'),
	);
	footerEl.replaceChildren(reroll, cont);
};

export const gridLeftRight = (offerCount: number, currentIdx: number, dir: 1 | -1): number => {
	if (currentIdx < 0 || currentIdx >= offerCount) return currentIdx;
	const row = Math.floor(currentIdx / MARKET_GRID_COLS);
	const col = currentIdx % MARKET_GRID_COLS;
	const nextCol = col + dir;
	if (nextCol < 0 || nextCol >= MARKET_GRID_COLS) return currentIdx;
	const nextIdx = row * MARKET_GRID_COLS + nextCol;
	return nextIdx < offerCount ? nextIdx : currentIdx;
};
