import { definePlugin } from '../types';

export const createBlastPlugin = () => definePlugin({
	id: 'blast',
	install: (world) => {
		world.addSystem('blast-update')
			.setPriority(400)
			.inPhase('update')
			.inScreens(['playing'])
			.setProcessEach({ with: ['blast'] }, ({ entity: { id, components: { blast } }, dt, ecs }) => {
				blast.life -= dt;
				if (blast.life <= 0) {
					blast.material.dispose();
					ecs.removeEntity(id);
					return;
				}
				const t = blast.life / blast.maxLife;
				blast.material.opacity = 0.9 * t;
			});
	},
});
