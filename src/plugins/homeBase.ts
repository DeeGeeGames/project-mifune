import { definePlugin, type World } from '../types';
import type { HomeBaseScreenState } from '../screen-types';
import { wrapIndex, renderMenuText, menuAxisDelta } from '../menu';
import { setScreenLegend, dpadVertical, type LegendSpec } from './legend';

const LEGEND_SPECS: readonly LegendSpec[] = [
	dpadVertical('Navigate'),
	{ action: 'menuConfirm', label: 'Confirm' },
];

const MENU_ITEMS = [
	{ id: 'deploy', label: 'Deploy: Wave Survival' },
	{ id: 'market', label: 'Market' },
	{ id: 'loadout', label: 'Loadout' },
] as const;

type MenuId = typeof MENU_ITEMS[number]['id'];

const MENU_ACTIONS: Record<MenuId, (ecs: World) => void> = {
	deploy: (ecs) => {
		const state = ecs.getScreenState('homeBase');
		void ecs.setScreen('playing', { waveNumber: state.nextWaveNumber });
	},
	market: (ecs) => {
		const state = ecs.getScreenState('homeBase');
		// TODO: Wire market/loadout/map actions through explicit base facilities and campaign state.
		void ecs.setScreen('market', {
			waveNumber: state.lastMissionResult?.waveNumber ?? state.nextWaveNumber,
			nextWaveNumber: state.nextWaveNumber,
			...(state.lastMissionResult ? { lastMissionResult: state.lastMissionResult } : {}),
		});
	},
	loadout: (ecs) => {
		// TODO: Wire loadout edits into base-owned campaign state instead of leaving this screen boundary lossy.
		void ecs.setScreen('loadoutSelect', {});
	},
};

const statsText = (state: HomeBaseScreenState): string => {
	if (!state.lastMissionResult) return 'No missions completed';
	return `Last mission: Wave Survival\n` +
		`Enemies killed: ${state.lastMissionResult.kills}\n` +
		`Resources gained: ${state.lastMissionResult.resourcesCollected}`;
};

export const createHomeBasePlugin = () => definePlugin({
	id: 'homeBase',
	install: (world) => {
		let lastRenderedIndex = -1;

		world.onScreenEnter('homeBase', () => {
			// TODO: Replace the old summary DOM with a real home-base surface.
			const state = world.getScreenState('homeBase');
			const hudRefs = world.getResource('hudRefs');
			hudRefs.summaryTitleEl.textContent = 'HOME BASE';
			hudRefs.summaryStatsEl.textContent = statsText(state);
			hudRefs.summaryMenuEl.textContent = renderMenuText(MENU_ITEMS, state.selectedIndex, (item) => item.label);
			hudRefs.summaryEl.style.display = 'flex';
			lastRenderedIndex = state.selectedIndex;
			setScreenLegend(world, 'homeBase', LEGEND_SPECS);
		});

		world.onScreenExit('homeBase', () => {
			world.getResource('hudRefs').summaryEl.style.display = 'none';
		});

		world.addSystem('home-base')
			.setPriority(100)
			.inPhase('update')
			.inScreens(['homeBase'])
			.withResources(['inputState', 'hudRefs'])
			.setProcess(({ ecs, resources: { inputState, hudRefs } }) => {
				const state = ecs.getScreenState('homeBase');

				const delta = menuAxisDelta(inputState, 'menuUp', 'menuDown');
				if (delta !== 0) {
					state.selectedIndex = wrapIndex(state.selectedIndex + delta, MENU_ITEMS.length);
				}

				if (inputState.actions.justActivated('menuConfirm')) {
					const item = MENU_ITEMS[state.selectedIndex];
					if (item) MENU_ACTIONS[item.id](ecs);
				}

				if (state.selectedIndex !== lastRenderedIndex) {
					hudRefs.summaryMenuEl.textContent = renderMenuText(MENU_ITEMS, state.selectedIndex, (item) => item.label);
					lastRenderedIndex = state.selectedIndex;
				}
			});
	},
});
