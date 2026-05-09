import type { ShopOffer } from './shop';

export type AppScreenName = 'title' | 'loadoutSelect' | 'playing' | 'waveSummary' | 'market';

export type PlayingScreenConfig = {
	waveNumber: number;
};

export type PlayingScreenState = {
	waveNumber: number;
	phaseTimer: number;
	spawnTimer: number;
	spawnIntervalMs: number;
	kills: number;
	resourcesCollected: number;
};

export type WaveSummaryConfig = {
	waveNumber: number;
	kills: number;
	resourcesCollected: number;
};

export type WaveSummaryScreenState = WaveSummaryConfig & {
	selectedIndex: number;
};

export type TitleScreenState = {
	selectedIndex: number;
};

export type LoadoutCategory = 'weapon' | 'auxiliary';

export type LoadoutScreenState = {
	category: LoadoutCategory;
	selectedPylonIdx: number;
	selectedAuxIdx: number;
	facingMode: boolean;
};

export type MarketScreenConfig = {
	waveNumber: number;
};

export type MarketMode =
	| { kind: 'browse' }
	| { kind: 'assignPylon'; offerIdx: number };

export type MarketScreenState = {
	waveNumber: number;
	offers: ShopOffer[];
	rerollCount: number;
	mode: MarketMode;
	selectedIndex: number;
};
