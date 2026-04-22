import { definePlugin } from '../types';

export const createBlastPlugin = () => definePlugin({
	id: 'blast',
	install: (world) => {
		world.addSystem('blast-update')
			.setPriority(400)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('blasts', { with: ['blast'] })
			.setProcess(({ queries, dt, ecs }) => {
				for (const { id, components: { blast } } of queries.blasts) {
					blast.life -= dt;
					if (blast.life <= 0) {
						blast.material.dispose();
						ecs.removeEntity(id);
						continue;
					}
					const t = blast.life / blast.maxLife;
					blast.material.opacity = 0.9 * t;
				}
			});
	},
});
