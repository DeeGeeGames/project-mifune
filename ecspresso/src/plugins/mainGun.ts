import { definePlugin } from '../types';
import { forwardXZ, mountToWorld, normalizeAngle } from '../math';
import { segmentHitDistance } from '../hit';
import { getOwnerState } from './turret';
import { killEnemyAndDrop } from './combat';

export const createMainGunPlugin = () => definePlugin({
	id: 'mainGun',
	install: (world) => {
		world.addSystem('main-gun-fire')
			.setPriority(220)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('guns', { with: ['mainGunBeam'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.setProcess(({ queries, dt, ecs }) => {
				for (const { components: { mainGunBeam: gun } } of queries.guns) {
					const owner = getOwnerState(ecs, gun.ownerId);
					if (!owner) continue;

					const { x: originX, z: originZ } = mountToWorld(owner.x, owner.z, owner.heading, gun.mountX, gun.mountZ);
					const fireAngleWorld = normalizeAngle(owner.heading + gun.facing);
					const fwd = forwardXZ(fireAngleWorld);

					if (gun.state === 'idle') {
						let targetFound = false;
						for (const { components: { enemy, localTransform3D: et } } of queries.enemies) {
							const d = segmentHitDistance(originX, originZ, fwd.x, fwd.z, gun.detectionRange, et.x, et.z, enemy.radius, gun.beamRadius);
							if (d !== Infinity) {
								targetFound = true;
								break;
							}
						}
						if (!targetFound) continue;
						gun.state = 'firing';
						gun.stateTimerMs = gun.beamDurationMs;
						gun.beamMesh.visible = true;
						continue;
					}

					if (gun.state === 'cooldown') {
						gun.stateTimerMs -= dt * 1000;
						if (gun.stateTimerMs <= 0) {
							gun.state = 'idle';
							gun.stateTimerMs = 0;
						}
						continue;
					}

					gun.stateTimerMs -= dt * 1000;
					const damageThisFrame = gun.damagePerSecond * dt;

					for (const { id, components: { enemy, localTransform3D: et } } of queries.enemies) {
						const d = segmentHitDistance(originX, originZ, fwd.x, fwd.z, gun.visualLength, et.x, et.z, enemy.radius, gun.beamRadius);
						if (d === Infinity) continue;
						enemy.hp -= damageThisFrame;
						enemy.hitEscalation += damageThisFrame;
						if (enemy.hp <= 0) killEnemyAndDrop(ecs, id, et.x, et.z);
					}

					if (gun.stateTimerMs <= 0) {
						gun.state = 'cooldown';
						gun.stateTimerMs = gun.beamCooldownMs;
						gun.beamMesh.visible = false;
					}
				}
			});
	},
});
