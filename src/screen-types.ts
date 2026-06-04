import type { ShopOffer } from './shop-types';
import type { MapNodeId } from './campaign';

export type AppScreenName = 'title' | 'loadoutSelect' | 'playing' | 'homeBase' | 'sectorMap' | 'market';

export type WaveSurvivalMissionConfig = {
	readonly missionId: MapNodeId;
	readonly missionType: 'waveSurvival';
	readonly waveNumber: number;
};

export type PlayingScreenConfig = {
	readonly mission: WaveSurvivalMissionConfig;
};

export type PlayingScreenState = {
	mission: WaveSurvivalMissionConfig;
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
