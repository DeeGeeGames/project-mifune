import { definePlugin } from '../types';
import { distanceXZ } from '../math';
import { ENEMY_RADIUS, PROJECTILE_RADIUS, PICKUP_VALUE } from '../constants';
import { pickupMesh } from '../ships';
import { createMeshComponents } from 'ecspresso/plugins/rendering/renderer3D';

export const createCombatPlugin = () => definePlugin({
	id: 'combat',
	install: (world) => {
		world.addSystem('projectile-integrate')
			.setPriority(300)
			.inPhase('update')
			.addQuery('projectiles', { with: ['projectile', 'localTransform3D'] })
			.setProcess(({ queries, dt, ecs }) => {
				for (const { id, components: { projectile, localTransform3D } } of queries.projectiles) {
					projectile.life -= dt;
					if (projectile.life <= 0) {
						ecs.removeEntity(id);
						continue;
					}
					localTransform3D.x += projectile.vx * dt;
					localTransform3D.z += projectile.vz * dt;
					ecs.markChanged(id, 'localTransform3D');
				}
			});

		world.addSystem('projectile-hit')
			.setPriority(310)
			.inPhase('update')
			.addQuery('projectiles', { with: ['projectile', 'localTransform3D'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.setProcess(({ queries, ecs }) => {
				const hitRadius = ENEMY_RADIUS + PROJECTILE_RADIUS;
				for (const { id: projId, components: { projectile, localTransform3D: pt } } of queries.projectiles) {
					for (const { id: enemyId, components: { enemy, localTransform3D: et } } of queries.enemies) {
						const d = distanceXZ(pt.x, pt.z, et.x, et.z);
						if (d > hitRadius) continue;

						enemy.hp -= projectile.damage;
						ecs.removeEntity(projId);

						if (enemy.hp <= 0) {
							ecs.eventBus.publish('enemy:killed', { entityId: enemyId, x: et.x, z: et.z });
							ecs.spawn({
								...createMeshComponents(pickupMesh(), { x: et.x, y: 0.25, z: et.z }),
								pickup: { value: PICKUP_VALUE, magnetized: false },
							});
							ecs.removeEntity(enemyId);
						}
						break;
					}
				}
			});
	},
});
