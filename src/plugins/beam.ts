import { definePlugin } from '../types';
import { angleDiff, bearingXZ, distanceXZ, forwardXZ, mountToWorld, normalizeAngle, stepAngle } from '../math';
import { BEAM_IMPACT_COOLDOWN_SEC, BEAM_RADIUS, MUZZLE_OFFSET, SHIP_HIT_RADIUS, TURRET_TURN_RATE } from '../constants';
import { getOwnerState } from './turret';
import { destroyShip, killEnemyAndDrop } from './combat';
import { applyDamageToShip } from './shield';
import { segmentHitDistance } from '../hit';
import { spawnImpactSpark } from './vfx';

const beamImpactCooldowns = new Map<number, number>();

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
				for (const { id: turretId, components: { beamTurret: turret } } of queries.turrets) {
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
								const d = segmentHitDistance(originX, originZ, fwd.x, fwd.z, beamLen, et.x, et.z, enemy.radius, BEAM_RADIUS);
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
								const d = segmentHitDistance(originX, originZ, fwd.x, fwd.z, beamLen, st.x, st.z, SHIP_HIT_RADIUS, BEAM_RADIUS);
								if (d >= closestDist) continue;
								closestDist = d;
								closestShipId = id;
							}
							if (closestShipId !== -1) {
								const ship = ecs.getComponent(closestShipId, 'ship');
								if (ship) {
									applyDamageToShip(ecs, closestShipId, damageThisFrame, ship);
									if (ship.hp <= 0) destroyShip(ecs, closestShipId, ship.class);
								}
							}
						}

						turret.beamMesh.scale.z = closestDist === Infinity ? beamLen : closestDist;

						const prevCooldown = beamImpactCooldowns.get(turretId) ?? 0;
						const nextCooldown = prevCooldown - dt;
						if (closestDist !== Infinity && nextCooldown <= 0) {
							const impactX = originX + fwd.x * closestDist;
							const impactZ = originZ + fwd.z * closestDist;
							spawnImpactSpark(ecs, impactX, impactZ, 'railgun');
							beamImpactCooldowns.set(turretId, BEAM_IMPACT_COOLDOWN_SEC);
						} else {
							beamImpactCooldowns.set(turretId, Math.max(0, nextCooldown));
						}
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
