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
			.addQuery('flagship', { with: ['commandVessel', 'kinematic'] })
			.withResources(['playerState', 'hudRefs'])
			.setProcess(({ queries, resources: { playerState, hudRefs } }) => {
				hudRefs.resourcesEl.textContent = `Resources: ${Math.floor(playerState.resources)}`;

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
