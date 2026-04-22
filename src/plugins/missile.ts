import { definePlugin } from '../types';
import { angleDiff, bearingXZ, distanceXZ, forwardXZ, mountToWorld, normalizeAngle, stepAngle } from '../math';
import { missileMesh } from '../ships';
import { createMeshComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { canFire, recordShot } from '../weapons';
import { getOwnerState } from './turret';
import { killEnemyAndDrop } from './combat';
import { spawnImpactSpark, spawnMuzzleFlash } from './vfx';
import {
	MISSILE_LAUNCH_SPEED,
	MISSILE_LIFE_SEC,
	MISSILE_RADIUS,
	MISSILE_SPEED,
	MISSILE_TURN_RATE,
	MISSILE_UNGUIDED_SEC,
	MUZZLE_OFFSET,
} from '../constants';

export const createMissilePlugin = () => definePlugin({
	id: 'missile',
	install: (world) => {
		world.addSystem('missile-fire')
			.setPriority(220)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('turrets', { with: ['missileTurret', 'burstFire'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.setProcess(({ queries, ecs }) => {
				const now = performance.now();
				for (const { components: { missileTurret: turret, burstFire } } of queries.turrets) {
					if (!canFire(burstFire, now)) continue;

					const owner = getOwnerState(ecs, turret.ownerShipId);
					if (!owner) continue;

					const { x: mountWorldX, z: mountWorldZ } = mountToWorld(
						owner.x, owner.z, owner.heading, turret.mountX, turret.mountZ,
					);
					const detectWorld = normalizeAngle(owner.heading + turret.baseAngle);

					let nearestId: number | null = null;
					let nearestDist = Infinity;
					for (const { id: enemyId, components: { localTransform3D: et } } of queries.enemies) {
						const d = distanceXZ(mountWorldX, mountWorldZ, et.x, et.z);
						if (d > turret.range) continue;
						const ang = bearingXZ(mountWorldX, mountWorldZ, et.x, et.z);
						if (Math.abs(angleDiff(ang, detectWorld)) > turret.coneHalf) continue;
						if (d >= nearestDist) continue;
						nearestDist = d;
						nearestId = enemyId;
					}

					if (nearestId === null) continue;

					const launchWorld = normalizeAngle(owner.heading + turret.fireAngle);
					const fwd = forwardXZ(launchWorld);
					const muzzleX = mountWorldX + fwd.x * MUZZLE_OFFSET;
					const muzzleZ = mountWorldZ + fwd.z * MUZZLE_OFFSET;

					ecs.spawn({
						...createMeshComponents(missileMesh(), { x: muzzleX, y: 0.6, z: muzzleZ }, { rotation: { y: launchWorld } }),
						missile: {
							heading: launchWorld,
							speed: MISSILE_LAUNCH_SPEED,
							life: MISSILE_LIFE_SEC,
							unguidedTime: MISSILE_UNGUIDED_SEC,
							damage: turret.damage,
							targetId: nearestId,
						},
					});

					spawnMuzzleFlash(ecs, muzzleX, muzzleZ, launchWorld, 'missile');
					recordShot(burstFire, now);
				}
			});

		world.addSystem('missile-update')
			.setPriority(300)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('missiles', { with: ['missile', 'localTransform3D'] })
			.setProcess(({ queries, dt, ecs }) => {
				for (const { id, components: { missile, localTransform3D } } of queries.missiles) {
					missile.life -= dt;
					if (missile.life <= 0) {
						ecs.removeEntity(id);
						continue;
					}

					if (missile.unguidedTime > 0) {
						missile.unguidedTime -= dt;
					} else if (missile.targetId !== null) {
						const targetTransform = ecs.getComponent(missile.targetId, 'localTransform3D');
						const targetEnemy = ecs.getComponent(missile.targetId, 'enemy');
						if (!targetTransform || !targetEnemy) {
							missile.targetId = null;
						} else {
							const desired = bearingXZ(localTransform3D.x, localTransform3D.z, targetTransform.x, targetTransform.z);
							missile.heading = stepAngle(missile.heading, desired, MISSILE_TURN_RATE * dt);
							missile.speed = MISSILE_SPEED;
						}
					}

					const fwd = forwardXZ(missile.heading);
					localTransform3D.x += fwd.x * missile.speed * dt;
					localTransform3D.z += fwd.z * missile.speed * dt;
					localTransform3D.ry = missile.heading;
					ecs.markChanged(id, 'localTransform3D');
				}
			});

		world.addSystem('missile-hit')
			.setPriority(310)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('missiles', { with: ['missile', 'localTransform3D'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.setProcess(({ queries, ecs }) => {
				for (const { id: missileId, components: { missile, localTransform3D: mt } } of queries.missiles) {
					for (const { id: enemyId, components: { enemy, localTransform3D: et } } of queries.enemies) {
						const d = distanceXZ(mt.x, mt.z, et.x, et.z);
						if (d > enemy.radius + MISSILE_RADIUS) continue;

						enemy.hp -= missile.damage;
						enemy.hitEscalation += missile.damage;
						const willKill = enemy.hp <= 0;
						if (!willKill) spawnImpactSpark(ecs, mt.x, mt.z, 'missile');
						ecs.removeEntity(missileId);

						if (willKill) killEnemyAndDrop(ecs, enemyId, et.x, et.z);
						break;
					}
				}
			});
	},
});
