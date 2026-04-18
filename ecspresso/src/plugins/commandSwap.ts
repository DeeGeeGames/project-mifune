import { definePlugin } from '../types';
import { reassignFormationSlots } from '../formation';

export const createCommandSwapPlugin = () => definePlugin({
	id: 'commandSwap',
	install: (world) => {
		world.addSystem('command-swap-listener')
			.setOnInitialize((ecs) => {
				ecs.eventBus.subscribe('vessel:cycleRequested', () => {
					const playerState = ecs.getResource('playerState');
					const cam3d = ecs.getResource('camera3DState');
					if (playerState.ownedShipIds.length < 2) return;

					const oldId = playerState.commandVesselId;
					const oldIdx = playerState.ownedShipIds.indexOf(oldId);
					if (oldIdx < 0) return;
					const nextIdx = (oldIdx + 1) % playerState.ownedShipIds.length;
					const newId = playerState.ownedShipIds[nextIdx];
					if (newId === undefined) return;

					playerState.ownedShipIds[oldIdx] = newId;
					playerState.ownedShipIds[nextIdx] = oldId;

					ecs.removeComponent(newId, 'formationSlot');
					ecs.addComponent(newId, 'commandVessel', true);
					ecs.removeComponent(oldId, 'commandVessel');
					ecs.addComponent(oldId, 'formationSlot', { flagshipId: newId, slotIndex: 0 });

					playerState.commandVesselId = newId;
					reassignFormationSlots(ecs, playerState);
					cam3d.follow(newId);

					ecs.eventBus.publish('ship:commandSwapped', { oldVesselId: oldId, newVesselId: newId });
				});
			});
	},
});
