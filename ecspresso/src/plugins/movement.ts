import { definePlugin } from '../types';
import { integrateKinematicXZ } from '../kinematic';

export const createMovementPlugin = () => definePlugin({
	id: 'movement',
	install: (world) => {
		world.addSystem('ship-movement')
			.setPriority(200)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('ships', {
				with: ['ship', 'kinematic', 'localTransform3D'],
				without: ['summonAnim'],
			})
			.setProcess(({ queries, dt, ecs }) => {
				for (const { id, components: { kinematic, localTransform3D } } of queries.ships) {
					integrateKinematicXZ(kinematic, localTransform3D, dt);
					ecs.markChanged(id, 'localTransform3D');
				}
			});
	},
});
