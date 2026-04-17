import { definePlugin } from '../types';
import { bearingXZ, distanceXZ, rotateY } from '../math';
import { FORMATION_RADIUS, FORMATION_ARRIVE_RADIUS } from '../constants';

export const createFormationPlugin = () => definePlugin({
	id: 'formation',
	install: (world) => {
		world.addSystem('formation')
			.setPriority(60)
			.inPhase('preUpdate')
			.addQuery('followers', {
				with: ['ship', 'formationSlot', 'localTransform3D'],
				without: ['summonAnim', 'commandVessel'],
			})
			.setProcess(({ queries, ecs }) => {
				for (const { components: { ship, formationSlot, localTransform3D } } of queries.followers) {
					const flagshipTransform = ecs.getComponent(formationSlot.flagshipId, 'localTransform3D');
					const flagshipShip = ecs.getComponent(formationSlot.flagshipId, 'ship');
					if (!flagshipTransform || !flagshipShip) {
						ship.throttle = 0;
						continue;
					}

					const slotLocal = {
						x: Math.sin(formationSlot.slotAngle) * FORMATION_RADIUS,
						z: Math.cos(formationSlot.slotAngle) * FORMATION_RADIUS,
					};
					const slotWorld = rotateY(slotLocal, flagshipShip.heading);
					const targetX = flagshipTransform.x + slotWorld.x;
					const targetZ = flagshipTransform.z + slotWorld.z;

					const dist = distanceXZ(localTransform3D.x, localTransform3D.z, targetX, targetZ);
					if (dist < FORMATION_ARRIVE_RADIUS * 0.5) {
						ship.throttle = 0;
						ship.headingTarget = flagshipShip.heading;
						continue;
					}

					ship.headingTarget = bearingXZ(localTransform3D.x, localTransform3D.z, targetX, targetZ);
					const throttle = Math.min(1, dist / FORMATION_ARRIVE_RADIUS);
					ship.throttle = throttle;
				}
			});
	},
});
