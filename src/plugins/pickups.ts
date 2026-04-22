import { definePlugin } from '../types';
import { bearingXZ, distanceXZ } from '../math';
import {
	PICKUP_COLLECT_RADIUS,
	PICKUP_MAGNET_RADIUS,
	PICKUP_MAGNET_SPEED,
} from '../constants';

export const createPickupsPlugin = () => definePlugin({
	id: 'pickups',
	install: (world) => {
		world.addSystem('pickups')
			.setPriority(320)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('pickups', { with: ['pickup', 'localTransform3D'] })
			.addQuery('flagship', { with: ['commandVessel', 'localTransform3D'] })
			.withResources(['playerState'])
			.setProcess(({ queries, dt, ecs, resources: { playerState } }) => {
				const flagship = queries.flagship[0];
				if (!flagship) return;
				const ft = flagship.components.localTransform3D;

				for (const { id, components: { pickup, localTransform3D } } of queries.pickups) {
					const d = distanceXZ(localTransform3D.x, localTransform3D.z, ft.x, ft.z);

					if (d <= PICKUP_COLLECT_RADIUS) {
						playerState.resources += pickup.value;
						ecs.eventBus.publish('pickup:collected', { value: pickup.value });
						ecs.removeEntity(id);
						continue;
					}

					if (d <= PICKUP_MAGNET_RADIUS) {
						pickup.magnetized = true;
					}

					if (!pickup.magnetized) continue;

					const angle = bearingXZ(localTransform3D.x, localTransform3D.z, ft.x, ft.z);
					localTransform3D.x += Math.sin(angle) * PICKUP_MAGNET_SPEED * dt;
					localTransform3D.z += Math.cos(angle) * PICKUP_MAGNET_SPEED * dt;
					ecs.markChanged(id, 'localTransform3D');
				}
			});
	},
});
