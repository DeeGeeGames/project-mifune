import type { ShopOffer } from './shop-types';

export type AppScreenName = 'title' | 'loadoutSelect' | 'playing' | 'homeBase' | 'sectorMap' | 'market';

export type PlayingScreenConfig = {
	// TODO: Replace waveNumber with missionId/missionType once home base launches more than Wave Survival.
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

export type LastMissionResult = {
	waveNumber: number;
	kills: number;
	resourcesCollected: number;
};

export type HomeBaseScreenState = {
	selectedIndex: number;
};

export type SectorMapScreenState = {
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
	nextWaveNumber: number;
	lastMissionResult?: LastMissionResult;
};

export type MarketMode =
	| { kind: 'browse' }
	| { kind: 'assignPylon'; offerIdx: number }
	| { kind: 'assignAux'; offerIdx: number };

export type MarketScreenState = {
	waveNumber: number;
	nextWaveNumber: number;
	lastMissionResult?: LastMissionResult;
	offers: ShopOffer[];
	rerollCount: number;
	mode: MarketMode;
	selectedIndex: number;
};
