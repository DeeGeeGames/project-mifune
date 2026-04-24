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
				mutates: ['kinematic', 'localTransform3D'],
			})
			.setProcess(({ queries, dt }) => {
				for (const { components: { kinematic, localTransform3D } } of queries.ships) {
					integrateKinematicXZ(kinematic, localTransform3D, dt);
				}
			});
	},
});
