import { definePlugin } from '../types';
import { setScreenLegend, type LegendSpec } from './legend';

const LEGEND_SPECS: readonly LegendSpec[] = [
	{ action: 'fwd',     label: 'Thrust', keyboardOverride: 'W/S', gamepadOverride: 'RT/LT' },
	{ action: 'aimGate', label: 'Aim',    keyboardOverride: null },
	{ action: 'zoomIn',  label: 'Zoom',   keyboardOverride: 'Q/E', gamepadOverride: null },
];

export const createHudPlugin = () => definePlugin({
	id: 'hud',
	install: (world) => {
		const setGameHudDisplay = (value: '' | 'none'): void => {
			world.getResource('hudRefs').gameHudEls.forEach((el) => { el.style.display = value; });
		};

		world.eventBus.subscribe('screenEnter', ({ screen }) => {
			if (screen !== 'playing') return;
			setGameHudDisplay('');
			setScreenLegend(world, 'playing', LEGEND_SPECS);
		});

		world.eventBus.subscribe('screenExit', ({ screen }) => {
			if (screen === 'playing') setGameHudDisplay('none');
		});

		world.addSystem('hud')
			.setPriority(100)
			.inPhase('render')
			.inScreens(['playing'])
			.addQuery('ships', { with: ['ship'] })
			.addQuery('flagship', { with: ['commandVessel', 'kinematic'] })
			.withResources(['playerState', 'hudRefs'])
			.setProcess(({ queries, ecs, resources: { playerState, hudRefs } }) => {
				hudRefs.resourcesEl.textContent = `Resources: ${Math.floor(playerState.resources)}`;

				const wave = ecs.getScreenState('playing');
				const secs = Math.max(0, Math.ceil(wave.phaseTimer));
				hudRefs.waveEl.textContent = `WAVE ${wave.waveNumber} — ${secs}s`;

				const rosterLines = queries.ships.map((e) => {
					const isFlag = e.id === playerState.commandVesselId ? '◆' : '·';
					return `${isFlag} ${e.components.ship.class}`;
				});
				hudRefs.rosterEl.textContent = rosterLines.join('\n');

				const throttle = queries.flagship[0]?.components.kinematic.throttle ?? 0;
				const fill = hudRefs.thrustBarFillEl;
				if (throttle >= 0) {
					fill.style.left = '50%';
					fill.style.width = `${throttle * 50}%`;
					fill.style.background = '#7fb2ff';
				} else {
					fill.style.left = `${50 + throttle * 50}%`;
					fill.style.width = `${Math.abs(throttle) * 50}%`;
					fill.style.background = '#ff6a6a';
				}
			});
	},
});
