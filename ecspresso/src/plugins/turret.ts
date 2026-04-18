import { definePlugin } from '../types';
import { angleDiff, bearingXZ, clamp, distanceXZ, forwardXZ, leadTarget, normalizeAngle, stepAngle } from '../math';
import { projectileMesh } from '../ships';
import { createMeshComponents } from 'ecspresso/plugins/rendering/renderer3D';
import {
	BULLET_LIFE_SEC,
	BULLET_SPEED,
	TURRET_RANGE,
	TURRET_TURN_RATE,
} from '../constants';

export const createTurretPlugin = () => definePlugin({
	id: 'turret',
	install: (world) => {
		world.addSystem('turret-aim')
			.setPriority(210)
			.inPhase('update')
			.addQuery('turrets', { with: ['turret'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.withResources(['playerState'])
			.setProcess(({ queries, dt, ecs, resources: { playerState } }) => {
				for (const { components: { turret } } of queries.turrets) {
					const ship = ecs.getComponent(turret.ownerShipId, 'ship');
					const shipTransform = ecs.getComponent(turret.ownerShipId, 'localTransform3D');
					if (!ship || !shipTransform) {
						turret.hasTarget = false;
						continue;
					}

					const mountLocal = { x: turret.mountX, z: turret.mountZ };
					const c = Math.cos(ship.heading);
					const s = Math.sin(ship.heading);
					const mountWorldX = shipTransform.x + mountLocal.x * c - mountLocal.z * s;
					const mountWorldZ = shipTransform.z + mountLocal.x * s + mountLocal.z * c;
					const baseWorld = normalizeAngle(ship.heading + turret.baseAngle);

					const isFlagship = ecs.getComponent(turret.ownerShipId, 'commandVessel');
					const overrideActive = playerState.controlMode === 'override' && isFlagship;

					let targetAngle: number | null = null;

					if (overrideActive) {
						targetAngle = playerState.overrideAimAngle;
					} else {
						let nearestDist = Infinity;
						let nearestX = 0;
						let nearestZ = 0;
						let nearestVx = 0;
						let nearestVz = 0;
						let found = false;

						for (const { components: { enemy: _enemy, localTransform3D: et } } of queries.enemies) {
							const d = distanceXZ(mountWorldX, mountWorldZ, et.x, et.z);
							if (d > TURRET_RANGE) continue;
							const ang = bearingXZ(mountWorldX, mountWorldZ, et.x, et.z);
							if (Math.abs(angleDiff(ang, baseWorld)) > turret.coneHalf) continue;
							if (d >= nearestDist) continue;
							nearestDist = d;
							nearestX = et.x;
							nearestZ = et.z;
							nearestVx = 0;
							nearestVz = 0;
							found = true;
							void _enemy;
						}

						if (found) {
							const lead = leadTarget(mountWorldX, mountWorldZ, nearestX, nearestZ, nearestVx, nearestVz, BULLET_SPEED);
							targetAngle = bearingXZ(mountWorldX, mountWorldZ, lead.x, lead.z);
						}
					}

					if (targetAngle === null) {
						turret.hasTarget = false;
						turret.aimAngle = stepAngle(turret.aimAngle, baseWorld, TURRET_TURN_RATE * dt);
						turret.mount.rotation.y = normalizeAngle(turret.aimAngle - ship.heading);
						continue;
					}

					const diff = angleDiff(targetAngle, baseWorld);
					const clampedDiff = clamp(diff, -turret.coneHalf, turret.coneHalf);
					const clampedTarget = normalizeAngle(baseWorld + clampedDiff);
					turret.aimAngle = stepAngle(turret.aimAngle, clampedTarget, TURRET_TURN_RATE * dt);
					turret.mount.rotation.y = normalizeAngle(turret.aimAngle - ship.heading);

					const aimedAtTarget = Math.abs(angleDiff(turret.aimAngle, clampedTarget)) < 0.05;
					turret.hasTarget = aimedAtTarget;
				}
			});

		world.addSystem('turret-fire')
			.setPriority(220)
			.inPhase('update')
			.addQuery('turrets', { with: ['turret'] })
			.withResources(['playerState'])
			.setProcess(({ queries, ecs, resources: { playerState } }) => {
				const now = performance.now();
				for (const { components: { turret } } of queries.turrets) {
					const isFlagship = ecs.getComponent(turret.ownerShipId, 'commandVessel');
					const overrideActive = playerState.controlMode === 'override' && isFlagship;
					const shouldFire = overrideActive || turret.hasTarget;
					if (!shouldFire) continue;
					if (now - turret.lastFiredAt < turret.fireIntervalMs) continue;

					const ship = ecs.getComponent(turret.ownerShipId, 'ship');
					const shipTransform = ecs.getComponent(turret.ownerShipId, 'localTransform3D');
					if (!ship || !shipTransform) continue;

					const c = Math.cos(ship.heading);
					const s = Math.sin(ship.heading);
					const mountWorldX = shipTransform.x + turret.mountX * c - turret.mountZ * s;
					const mountWorldZ = shipTransform.z + turret.mountX * s + turret.mountZ * c;

					const fwd = forwardXZ(turret.aimAngle);
					const muzzleX = mountWorldX + fwd.x * 0.9;
					const muzzleZ = mountWorldZ + fwd.z * 0.9;

					ecs.spawn({
						...createMeshComponents(projectileMesh(), { x: muzzleX, y: 0.6, z: muzzleZ }, { rotation: { y: turret.aimAngle } }),
						projectile: {
							vx: fwd.x * BULLET_SPEED,
							vz: fwd.z * BULLET_SPEED,
							life: BULLET_LIFE_SEC,
							damage: turret.damage,
						},
					});

					turret.lastFiredAt = now;
				}
			});
	},
});
