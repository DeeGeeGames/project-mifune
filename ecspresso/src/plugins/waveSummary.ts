import { definePlugin, type World } from '../types';
import { wrapIndex, renderMenuText, menuAxisDelta } from '../menu';

const MENU_ITEMS = [
	{ id: 'continue', label: 'Continue' },
] as const;

type MenuId = typeof MENU_ITEMS[number]['id'];

const MENU_ACTIONS: Record<MenuId, (ecs: World) => void> = {
	continue: (ecs) => {
		const state = ecs.getScreenState('waveSummary');
		void ecs.setScreen('playing', { waveNumber: state.waveNumber + 1 });
	},
};

export const createWaveSummaryPlugin = () => definePlugin({
	id: 'waveSummary',
	install: (world) => {
		world.eventBus.subscribe('screenEnter', ({ screen }) => {
			if (screen === 'waveSummary') world.getResource('hudRefs').summaryEl.style.display = 'flex';
		});

		world.eventBus.subscribe('screenExit', ({ screen }) => {
			if (screen === 'waveSummary') world.getResource('hudRefs').summaryEl.style.display = 'none';
		});

		let lastRenderedWave = -1;
		let lastRenderedIndex = -1;

		world.addSystem('wave-summary')
			.setPriority(100)
			.inPhase('update')
			.inScreens(['waveSummary'])
			.withResources(['inputState', 'hudRefs'])
			.setProcess(({ ecs, resources: { inputState, hudRefs } }) => {
				const state = ecs.getScreenState('waveSummary');

				const delta = menuAxisDelta(inputState, 'menuUp', 'menuDown');
				if (delta !== 0) {
					state.selectedIndex = wrapIndex(state.selectedIndex + delta, MENU_ITEMS.length);
				}

				if (inputState.actions.justActivated('menuConfirm')) {
					const item = MENU_ITEMS[state.selectedIndex];
					if (item) MENU_ACTIONS[item.id](ecs);
				}

				if (state.waveNumber !== lastRenderedWave) {
					hudRefs.summaryTitleEl.textContent = `WAVE ${state.waveNumber} COMPLETE`;
					hudRefs.summaryStatsEl.textContent =
						`Enemies killed: ${state.kills}\n` +
						`Resources gained: ${state.resourcesCollected}`;
					lastRenderedWave = state.waveNumber;
					lastRenderedIndex = -1;
				}

				if (state.selectedIndex !== lastRenderedIndex) {
					hudRefs.summaryMenuEl.textContent = renderMenuText(MENU_ITEMS, state.selectedIndex, (item) => item.label);
					lastRenderedIndex = state.selectedIndex;
				}
			});
	},
});
