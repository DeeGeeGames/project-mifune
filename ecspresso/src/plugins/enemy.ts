import { definePlugin } from '../types';
import { bearingXZ, distanceXZ } from '../math';
import { ENEMY_SPEED } from '../constants';

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
					const d = distanceXZ(localTransform3D.x, localTransform3D.z, ft.x, ft.z);
					if (d < 0.01) continue;
					const angle = bearingXZ(localTransform3D.x, localTransform3D.z, ft.x, ft.z);
					const vx = Math.sin(angle) * enemy.speed;
					const vz = Math.cos(angle) * enemy.speed;
					localTransform3D.x += vx * dt;
					localTransform3D.z += vz * dt;
					localTransform3D.ry = angle;
					ecs.markChanged(id, 'localTransform3D');
				}
			});
	},
});
