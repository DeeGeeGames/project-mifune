import { definePlugin } from '../types';
import { SHIP_SPECS, type ShipClass } from '../ships';

const SUMMON_ORDER: readonly ShipClass[] = ['corvette', 'frigate', 'destroyer', 'dreadnought'];

export const createHudPlugin = () => definePlugin({
	id: 'hud',
	install: (world) => {
		world.addSystem('hud')
			.setPriority(100)
			.inPhase('render')
			.addQuery('ships', { with: ['ship'] })
			.withResources(['playerState', 'hudRefs'])
			.setProcess(({ queries, resources: { playerState, hudRefs } }) => {
				hudRefs.resourcesEl.textContent = `Resources: ${Math.floor(playerState.resources)}`;
				hudRefs.modeEl.textContent = playerState.controlMode === 'override' ? 'OVERRIDE' : 'AUTO';
				hudRefs.modeEl.className = `hud-mode ${playerState.controlMode}`;

				const rosterLines = queries.ships.map((e) => {
					const isFlag = e.id === playerState.commandVesselId ? '◆' : '·';
					return `${isFlag} ${e.components.ship.class}`;
				});
				hudRefs.rosterEl.textContent = rosterLines.join('\n');

				const menuLines = SUMMON_ORDER.map((cls, idx) => {
					const spec = SHIP_SPECS[cls];
					const affordable = playerState.resources >= spec.cost;
					const selected = playerState.selectedSummon === cls ? '▶' : ' ';
					const suffix = affordable ? '' : ' (locked)';
					return `${selected} [${idx + 1}] ${cls} — ${spec.cost}${suffix}`;
				});
				hudRefs.menuEl.textContent = menuLines.join('\n');
			});
	},
});
