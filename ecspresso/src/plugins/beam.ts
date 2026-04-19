import { definePlugin } from '../types';
import { angleDiff, bearingXZ, distanceXZ, forwardXZ, mountToWorld, normalizeAngle, stepAngle } from '../math';
import { BEAM_RADIUS, MUZZLE_OFFSET, SHIP_HIT_RADIUS, TURRET_TURN_RATE } from '../constants';
import { getOwnerState } from './turret';
import { killEnemyAndDrop } from './combat';

const segmentHitDistance = (
	originX: number,
	originZ: number,
	dirX: number,
	dirZ: number,
	range: number,
	targetX: number,
	targetZ: number,
	targetRadius: number,
): number => {
	const rx = targetX - originX;
	const rz = targetZ - originZ;
	const t = rx * dirX + rz * dirZ;
	if (t < 0 || t > range) return Infinity;
	const px = rx - dirX * t;
	const pz = rz - dirZ * t;
	const reach = targetRadius + BEAM_RADIUS;
	return px * px + pz * pz <= reach * reach ? t : Infinity;
};

export const createBeamPlugin = () => definePlugin({
	id: 'beam',
	install: (world) => {
		world.addSystem('beam-aim')
			.setPriority(210)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('turrets', { with: ['beamTurret'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.addQuery('ships', { with: ['ship', 'localTransform3D'] })
			.setProcess(({ queries, dt, ecs }) => {
				for (const { components: { beamTurret: turret } } of queries.turrets) {
					const owner = getOwnerState(ecs, turret.ownerId);
					if (!owner) {
						turret.hasTarget = false;
						continue;
					}

					const { x: mountWorldX, z: mountWorldZ } = mountToWorld(
						owner.x, owner.z, owner.heading, turret.mountX, turret.mountZ,
					);
					const baseWorld = normalizeAngle(owner.heading + turret.baseAngle);

					if (turret.state === 'cooldown') {
						turret.hasTarget = false;
						turret.aimAngle = stepAngle(turret.aimAngle, baseWorld, TURRET_TURN_RATE * dt);
						turret.mount.rotation.y = normalizeAngle(turret.aimAngle - owner.heading);
						continue;
					}

					const candidates = turret.faction === 'ally' ? queries.enemies : queries.ships;

					let nearestDist = Infinity;
					let nearestX = 0;
					let nearestZ = 0;
					let nearestId = -1;

					if (turret.state === 'firing' && turret.targetId !== null) {
						const lockedTransform = ecs.getComponent(turret.targetId, 'localTransform3D');
						if (lockedTransform) {
							const d = distanceXZ(mountWorldX, mountWorldZ, lockedTransform.x, lockedTransform.z);
							const ang = bearingXZ(mountWorldX, mountWorldZ, lockedTransform.x, lockedTransform.z);
							if (d <= turret.range && Math.abs(angleDiff(ang, baseWorld)) <= turret.coneHalf) {
								nearestDist = d;
								nearestX = lockedTransform.x;
								nearestZ = lockedTransform.z;
								nearestId = turret.targetId;
							}
						}
					}

					if (nearestId === -1) {
						for (const { id, components: { localTransform3D: et } } of candidates) {
							const d = distanceXZ(mountWorldX, mountWorldZ, et.x, et.z);
							if (d > turret.range || d >= nearestDist) continue;
							const ang = bearingXZ(mountWorldX, mountWorldZ, et.x, et.z);
							if (Math.abs(angleDiff(ang, baseWorld)) > turret.coneHalf) continue;
							nearestDist = d;
							nearestX = et.x;
							nearestZ = et.z;
							nearestId = id;
						}
					}

					if (nearestId === -1) {
						turret.hasTarget = false;
						if (turret.state !== 'firing') turret.targetId = null;
						turret.aimAngle = stepAngle(turret.aimAngle, baseWorld, TURRET_TURN_RATE * dt);
						turret.mount.rotation.y = normalizeAngle(turret.aimAngle - owner.heading);
						continue;
					}

					const desired = bearingXZ(mountWorldX, mountWorldZ, nearestX, nearestZ);
					turret.aimAngle = stepAngle(turret.aimAngle, desired, TURRET_TURN_RATE * dt);
					turret.mount.rotation.y = normalizeAngle(turret.aimAngle - owner.heading);
					turret.hasTarget = Math.abs(angleDiff(turret.aimAngle, desired)) < 0.05;
					if (turret.state !== 'firing') turret.targetId = nearestId;
				}
			});

		world.addSystem('beam-fire')
			.setPriority(220)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('turrets', { with: ['beamTurret'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.addQuery('ships', { with: ['ship', 'localTransform3D'] })
			.setProcess(({ queries, dt, ecs }) => {
				for (const { components: { beamTurret: turret } } of queries.turrets) {
					if (turret.state === 'idle') {
						if (!turret.hasTarget) continue;
						turret.state = 'firing';
						turret.stateTimerMs = turret.beamDurationMs;
						turret.beamMesh.visible = true;
						continue;
					}

					if (turret.state === 'cooldown') {
						turret.stateTimerMs -= dt * 1000;
						if (turret.stateTimerMs <= 0) {
							turret.state = 'idle';
							turret.stateTimerMs = 0;
						}
						continue;
					}

					turret.stateTimerMs -= dt * 1000;

					const owner = getOwnerState(ecs, turret.ownerId);
					if (owner) {
						const { x: mountWorldX, z: mountWorldZ } = mountToWorld(
							owner.x, owner.z, owner.heading, turret.mountX, turret.mountZ,
						);
						const fwd = forwardXZ(turret.aimAngle);
						const originX = mountWorldX + fwd.x * MUZZLE_OFFSET;
						const originZ = mountWorldZ + fwd.z * MUZZLE_OFFSET;
						const beamLen = turret.range - MUZZLE_OFFSET;
						const damageThisFrame = turret.damagePerSecond * dt;

						let closestDist = Infinity;

						if (turret.faction === 'ally') {
							let closestEnemyId = -1;
							for (const { id, components: { enemy, localTransform3D: et } } of queries.enemies) {
								const d = segmentHitDistance(originX, originZ, fwd.x, fwd.z, beamLen, et.x, et.z, enemy.radius);
								if (d >= closestDist) continue;
								closestDist = d;
								closestEnemyId = id;
							}
							if (closestEnemyId !== -1) {
								const enemy = ecs.getComponent(closestEnemyId, 'enemy');
								const et = ecs.getComponent(closestEnemyId, 'localTransform3D');
								if (enemy && et) {
									enemy.hp -= damageThisFrame;
									enemy.hitEscalation += damageThisFrame;
									if (enemy.hp <= 0) killEnemyAndDrop(ecs, closestEnemyId, et.x, et.z);
								}
							}
						} else {
							let closestShipId = -1;
							for (const { id, components: { localTransform3D: st } } of queries.ships) {
								const d = segmentHitDistance(originX, originZ, fwd.x, fwd.z, beamLen, st.x, st.z, SHIP_HIT_RADIUS);
								if (d >= closestDist) continue;
								closestDist = d;
								closestShipId = id;
							}
							if (closestShipId !== -1) {
								const ship = ecs.getComponent(closestShipId, 'ship');
								if (ship) {
									ship.hp -= damageThisFrame;
									if (ship.hp <= 0) {
										ecs.eventBus.publish('ship:destroyed', { entityId: closestShipId, shipClass: ship.class });
										if (ship.class === 'carrier') ecs.eventBus.publish('carrier:destroyed', { entityId: closestShipId });
										ecs.removeEntity(closestShipId);
									}
								}
							}
						}

						turret.beamMesh.scale.z = closestDist === Infinity ? beamLen : closestDist;
					}

					if (turret.stateTimerMs <= 0) {
						turret.state = 'cooldown';
						turret.stateTimerMs = turret.beamCooldownMs;
						turret.beamMesh.visible = false;
						turret.targetId = null;
					}
				}
			});
	},
});
