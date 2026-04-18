import { definePlugin } from '../types';
import { bearingXZ } from '../math';
import { integrateKinematicXZ } from '../kinematic';

export const createEnemyPlugin = () => definePlugin({
	id: 'enemy',
	install: (world) => {
		world.addSystem('enemy-ai')
			.setPriority(250)
			.inPhase('update')
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.addQuery('flagship', { with: ['commandVessel', 'localTransform3D'] })
			.setProcess(({ queries, dt, ecs }) => {
				const flagship = queries.flagship[0];
				if (!flagship) return;
				const ft = flagship.components.localTransform3D;

				for (const { id, components: { localTransform3D, enemy } } of queries.enemies) {
					enemy.headingTarget = bearingXZ(localTransform3D.x, localTransform3D.z, ft.x, ft.z);
					enemy.throttle = 1;
					integrateKinematicXZ(enemy, localTransform3D, dt);
					ecs.markChanged(id, 'localTransform3D');
				}
			});
	},
});
