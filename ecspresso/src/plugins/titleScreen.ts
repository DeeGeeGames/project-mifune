import { definePlugin, type World } from '../types';
import { wrapIndex, renderMenuText, menuAxisDelta } from '../menu';

const MENU_ITEMS = [
	{ id: 'start', label: 'Start' },
	{ id: 'quit', label: 'Quit' },
] as const;

type MenuId = typeof MENU_ITEMS[number]['id'];

const MENU_ACTIONS: Record<MenuId, (ecs: World) => void> = {
	start: (ecs) => { void ecs.setScreen('loadoutSelect', {}); },
	quit: () => { window.close(); },
};

export const createTitleScreenPlugin = () => definePlugin({
	id: 'titleScreen',
	install: (world) => {
		world.eventBus.subscribe('screenEnter', ({ screen }) => {
			if (screen === 'title') world.getResource('hudRefs').titleEl.style.display = 'flex';
		});

		world.eventBus.subscribe('screenExit', ({ screen }) => {
			if (screen === 'title') world.getResource('hudRefs').titleEl.style.display = 'none';
		});

		let lastRenderedIndex = -1;

		world.addSystem('title-menu')
			.setPriority(100)
			.inPhase('update')
			.inScreens(['title'])
			.withResources(['inputState', 'hudRefs'])
			.setProcess(({ ecs, resources: { inputState, hudRefs } }) => {
				const state = ecs.getScreenState('title');

				const delta = menuAxisDelta(inputState, 'menuUp', 'menuDown');
				if (delta !== 0) {
					state.selectedIndex = wrapIndex(state.selectedIndex + delta, MENU_ITEMS.length);
				}

				if (inputState.actions.justActivated('menuConfirm')) {
					const item = MENU_ITEMS[state.selectedIndex];
					if (item) MENU_ACTIONS[item.id](ecs);
				}

				if (state.selectedIndex !== lastRenderedIndex) {
					hudRefs.titleMenuEl.textContent = renderMenuText(MENU_ITEMS, state.selectedIndex, (item) => item.label);
					lastRenderedIndex = state.selectedIndex;
				}
			});
	},
});
