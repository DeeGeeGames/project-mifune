import { definePlugin } from '../types';
import { integrateKinematicXZ } from '../kinematic';

export const createMovementPlugin = () => definePlugin({
	id: 'movement',
	install: (world) => {
		world.addSystem('ship-movement')
			.setPriority(200)
			.inPhase('update')
			.inScreens(['playing'])
			.setProcessEach({
				with: ['ship', 'kinematic', 'localTransform3D'],
				without: ['summonAnim'],
				mutates: ['kinematic', 'localTransform3D'],
			}, ({ entity: { components: { kinematic, localTransform3D } }, dt }) => {
				integrateKinematicXZ(kinematic, localTransform3D, dt);
			});
	},
});
