import type { ShipClass } from './ships';
import type { AppScreenName } from './screen-types';

export interface PlayerState {
	resources: number;
	ownedShipIds: number[];
	commandVesselId: number;
	selectedSummon: ShipClass;
	pendingHeading: number;
	headingPreviewActive: boolean;
	confirm: { timer: number; oldGoal: number; facing: number } | null;
}

export interface CursorState {
	x: number;
	z: number;
	valid: boolean;
}

export type InputScheme = 'keyboard' | 'gamepad';

export interface LegendEntry {
	keyboard: string | null;
	gamepad: string | null;
	label: string;
}

export interface LegendState {
	scheme: InputScheme;
	entriesByScreen: Partial<Record<AppScreenName, readonly LegendEntry[]>>;
	extraEntries: readonly LegendEntry[];
}

export interface HudRefs {
	resourcesEl: HTMLElement;
	rosterEl: HTMLElement;
	menuEl: HTMLElement;
	thrustBarFillEl: HTMLElement;
	waveEl: HTMLElement;
	gameHudEls: readonly HTMLElement[];
	summaryEl: HTMLElement;
	summaryTitleEl: HTMLElement;
	summaryStatsEl: HTMLElement;
	summaryMenuEl: HTMLElement;
	titleEl: HTMLElement;
	titleMenuEl: HTMLElement;
	loadoutEl: HTMLElement;
	loadoutStatCardEl: HTMLElement;
	marketEl: HTMLElement;
	marketTitleEl: HTMLElement;
	marketResourcesEl: HTMLElement;
	marketGridEl: HTMLElement;
	marketFooterEl: HTMLElement;
	marketAssignEl: HTMLElement;
	marketStatCardEl: HTMLElement;
	legendEl: HTMLElement;
}
