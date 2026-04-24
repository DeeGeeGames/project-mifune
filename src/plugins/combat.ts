import { definePlugin, type World } from '../types';
import { distanceXZ } from '../math';
import { PROJECTILE_RADIUS, PICKUP_VALUE, SHIP_HIT_RADIUS, BLAST_LIFE_SEC } from '../constants';
import { pickupMesh, createBlast, SHIP_SPECS, type ShipClass } from '../ships';
import { createMeshComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { applyDamageToShip } from './shield';
import { onFighterDestroyed } from './hangar';
import { spawnDeathExplosion, spawnImpactSpark, type FxKind } from './vfx';

export function killEnemyAndDrop(ecs: World, enemyId: number, x: number, z: number): void {
	const enemy = ecs.getComponent(enemyId, 'enemy');
	const radius = enemy?.radius ?? 0.6;
	spawnDeathExplosion(ecs, x, z, radius, 'enemy');
	ecs.eventBus.publish('enemy:killed', { entityId: enemyId, x, z });
	ecs.spawn({
		...createMeshComponents(pickupMesh(), { x, y: 0.25, z }),
		pickup: { value: PICKUP_VALUE, magnetized: false },
	}, { scope: 'playing' });
	ecs.removeEntity(enemyId);
}

export function destroyShip(ecs: World, shipId: number, shipClass: ShipClass): void {
	const transform = ecs.getComponent(shipId, 'localTransform3D');
	if (transform) {
		const spec = SHIP_SPECS[shipClass];
		const radius = Math.max(spec.hullWidth, spec.hullLength) * 0.5;
		spawnDeathExplosion(ecs, transform.x, transform.z, radius, 'ship');
	}
	ecs.eventBus.publish('ship:destroyed', { entityId: shipId, shipClass });
	if (shipClass === 'carrier') {
		ecs.eventBus.publish('carrier:destroyed', { entityId: shipId });
	}
	if (shipClass === 'fighter') {
		onFighterDestroyed(ecs, shipId);
		return;
	}
	ecs.removeEntity(shipId);
}

function spawnBlast(ecs: World, x: number, z: number, radius: number): void {
	const { mesh, material } = createBlast();
	ecs.spawn({
		...createMeshComponents(mesh, { x, y: 0.1, z }, { scale: radius }),
		blast: { life: BLAST_LIFE_SEC, maxLife: BLAST_LIFE_SEC, material },
	}, { scope: 'playing' });
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
					const splashDamage = projectile.splashDamage ?? 0;
					const splashRadius = projectile.splashRadius ?? 0;
					const hasSplash = splashDamage > 0 && splashRadius > 0;

					const projectileKind: FxKind = projectile.kind ?? 'bullet';

					if (projectile.faction === 'ally') {
						for (const { id: enemyId, components: { enemy, localTransform3D: et } } of queries.enemies) {
							const pierceRemaining = projectile.pierce;
							if (pierceRemaining !== undefined && projectile.hitTargets?.has(enemyId)) continue;
							const d = distanceXZ(pt.x, pt.z, et.x, et.z);
							if (d > enemy.radius + PROJECTILE_RADIUS) continue;
							enemy.hp -= projectile.damage;
							enemy.hitEscalation += projectile.damage;
							const willKill = enemy.hp <= 0;
							if (!willKill) spawnImpactSpark(ecs, pt.x, pt.z, projectileKind);
							if (willKill) killEnemyAndDrop(ecs, enemyId, et.x, et.z);
							if (pierceRemaining !== undefined) {
								projectile.hitTargets?.add(enemyId);
								const next = pierceRemaining - 1;
								projectile.pierce = next;
								if (next <= 0) {
									ecs.removeEntity(projId);
									break;
								}
								continue;
							}
							const impactX = pt.x;
							const impactZ = pt.z;
							ecs.removeEntity(projId);
							if (hasSplash) {
								spawnBlast(ecs, impactX, impactZ, splashRadius);
								for (const { id: otherId, components: { enemy: other, localTransform3D: ot } } of queries.enemies) {
									if (otherId === enemyId) continue;
									const sd = distanceXZ(impactX, impactZ, ot.x, ot.z);
									if (sd > splashRadius + other.radius) continue;
									other.hp -= splashDamage;
									other.hitEscalation += splashDamage;
									if (other.hp <= 0) killEnemyAndDrop(ecs, otherId, ot.x, ot.z);
								}
							}
							break;
						}
						continue;
					}

					for (const { id: shipId, components: { ship, localTransform3D: st } } of queries.ships) {
						const d = distanceXZ(pt.x, pt.z, st.x, st.z);
						if (d > shipHitRadius) continue;
						applyDamageToShip(ecs, shipId, projectile.damage, ship);
						const impactX = pt.x;
						const impactZ = pt.z;
						ecs.removeEntity(projId);
						const willDestroy = ship.hp <= 0;
						if (!willDestroy) spawnImpactSpark(ecs, impactX, impactZ, projectileKind);
						if (willDestroy) destroyShip(ecs, shipId, ship.class);
						if (hasSplash) {
							spawnBlast(ecs, impactX, impactZ, splashRadius);
							for (const { id: otherId, components: { ship: other, localTransform3D: ot } } of queries.ships) {
								if (otherId === shipId) continue;
								const sd = distanceXZ(impactX, impactZ, ot.x, ot.z);
								if (sd > splashRadius + SHIP_HIT_RADIUS) continue;
								applyDamageToShip(ecs, otherId, splashDamage, other);
								if (other.hp <= 0) destroyShip(ecs, otherId, other.class);
							}
						}
						break;
					}
				}
			});
	},
});
