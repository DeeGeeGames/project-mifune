import { definePlugin, type World } from '../types';
import { distanceXZ } from '../math';
import { PROJECTILE_RADIUS, PICKUP_VALUE, SHIP_HIT_RADIUS } from '../constants';
import { pickupMesh } from '../ships';
import { createMeshComponents } from 'ecspresso/plugins/rendering/renderer3D';

export function killEnemyAndDrop(ecs: World, enemyId: number, x: number, z: number): void {
	ecs.eventBus.publish('enemy:killed', { entityId: enemyId, x, z });
	ecs.spawn({
		...createMeshComponents(pickupMesh(), { x, y: 0.25, z }),
		pickup: { value: PICKUP_VALUE, magnetized: false },
	});
	ecs.removeEntity(enemyId);
}

export const createCombatPlugin = () => definePlugin({
	id: 'combat',
	install: (world) => {
		world.addSystem('projectile-integrate')
			.setPriority(300)
			.inPhase('update')
			.inScreens(['playing'])
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
			.inScreens(['playing'])
			.addQuery('projectiles', { with: ['projectile', 'localTransform3D'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.addQuery('ships', { with: ['ship', 'localTransform3D'] })
			.setProcess(({ queries, ecs }) => {
				const shipHitRadius = SHIP_HIT_RADIUS + PROJECTILE_RADIUS;
				for (const { id: projId, components: { projectile, localTransform3D: pt } } of queries.projectiles) {
					if (projectile.faction === 'ally') {
						for (const { id: enemyId, components: { enemy, localTransform3D: et } } of queries.enemies) {
							const d = distanceXZ(pt.x, pt.z, et.x, et.z);
							if (d > enemy.radius + PROJECTILE_RADIUS) continue;
							enemy.hp -= projectile.damage;
							enemy.hitEscalation += projectile.damage;
							ecs.removeEntity(projId);
							if (enemy.hp <= 0) killEnemyAndDrop(ecs, enemyId, et.x, et.z);
							break;
						}
						continue;
					}

					for (const { id: shipId, components: { ship, localTransform3D: st } } of queries.ships) {
						const d = distanceXZ(pt.x, pt.z, st.x, st.z);
						if (d > shipHitRadius) continue;
						ship.hp -= projectile.damage;
						ecs.removeEntity(projId);
						if (ship.hp <= 0) {
							ecs.eventBus.publish('ship:destroyed', { entityId: shipId, shipClass: ship.class });
							if (ship.class === 'carrier') {
								ecs.eventBus.publish('carrier:destroyed', { entityId: shipId });
							}
							ecs.removeEntity(shipId);
						}
						break;
					}
				}
			});
	},
});
