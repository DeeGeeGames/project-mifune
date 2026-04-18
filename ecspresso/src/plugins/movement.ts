import { definePlugin } from '../types';
import { integrateKinematicXZ } from '../kinematic';

export const createMovementPlugin = () => definePlugin({
	id: 'movement',
	install: (world) => {
		world.addSystem('ship-movement')
			.setPriority(200)
			.inPhase('update')
			.addQuery('ships', {
				with: ['ship', 'localTransform3D'],
				without: ['summonAnim'],
			})
			.setProcess(({ queries, dt, ecs }) => {
				for (const { id, components: { ship, localTransform3D } } of queries.ships) {
					integrateKinematicXZ(ship, localTransform3D, dt);
					ecs.markChanged(id, 'localTransform3D');
				}
			});
	},
});
