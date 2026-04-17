import { definePlugin } from '../types';

export const createCommandSwapPlugin = () => definePlugin({
	id: 'commandSwap',
	install: (world) => {
		world.addSystem('command-swap-listener')
			.setOnInitialize((ecs) => {
				ecs.eventBus.subscribe('vessel:cycleRequested', () => {
					const playerState = ecs.getResource('playerState');
					const cam3d = ecs.getResource('camera3DState');
					if (playerState.ownedShipIds.length < 2) return;

					const currentIdx = playerState.ownedShipIds.indexOf(playerState.commandVesselId);
					if (currentIdx < 0) return;
					const nextIdx = (currentIdx + 1) % playerState.ownedShipIds.length;
					const nextId = playerState.ownedShipIds[nextIdx];
					if (nextId === undefined) return;

					const oldId = playerState.commandVesselId;

					ecs.removeComponent(oldId, 'commandVessel');
					const freedSlotAngle = pickSlotAngleFor(ecs, playerState);
					ecs.addComponent(oldId, 'formationSlot', { flagshipId: nextId, slotAngle: freedSlotAngle });

					ecs.removeComponent(nextId, 'formationSlot');
					ecs.addComponent(nextId, 'commandVessel', true);

					for (const id of playerState.ownedShipIds) {
						if (id === nextId) continue;
						const slot = ecs.getComponent(id, 'formationSlot');
						if (slot) slot.flagshipId = nextId;
					}

					playerState.commandVesselId = nextId;
					cam3d.follow(nextId);

					ecs.eventBus.publish('ship:commandSwapped', { oldVesselId: oldId, newVesselId: nextId });
				});
			});
	},
});

function pickSlotAngleFor(
	ecs: { getComponent: (id: number, name: 'formationSlot') => { slotAngle: number } | undefined },
	playerState: { ownedShipIds: readonly number[] },
): number {
	const usedAngles = playerState.ownedShipIds
		.map((id) => ecs.getComponent(id, 'formationSlot')?.slotAngle)
		.filter((a): a is number => a !== undefined);
	const step = (Math.PI * 2) / Math.max(1, playerState.ownedShipIds.length);
	for (let i = 0; i < playerState.ownedShipIds.length; i++) {
		const candidate = i * step;
		if (!usedAngles.some((a) => Math.abs(a - candidate) < 0.01)) return candidate;
	}
	return 0;
}
