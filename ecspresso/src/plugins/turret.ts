import { definePlugin } from '../types';
import { angleDiff, bearingXZ, clamp, distanceXZ, forwardXZ, leadTarget, mountToWorld, normalizeAngle, stepAngle } from '../math';
import { projectileMesh } from '../ships';
import { createMeshComponents } from 'ecspresso/plugins/rendering/renderer3D';
import {
	BULLET_LIFE_SEC,
	BULLET_SPEED,
	MUZZLE_OFFSET,
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
			.setProcess(({ queries, dt, ecs }) => {
				for (const { components: { turret } } of queries.turrets) {
					const ship = ecs.getComponent(turret.ownerShipId, 'ship');
					const shipTransform = ecs.getComponent(turret.ownerShipId, 'localTransform3D');
					if (!ship || !shipTransform) {
						turret.hasTarget = false;
						continue;
					}

					const { x: mountWorldX, z: mountWorldZ } = mountToWorld(
						shipTransform.x, shipTransform.z, ship.heading, turret.mountX, turret.mountZ,
					);
					const baseWorld = normalizeAngle(ship.heading + turret.baseAngle);

					let targetAngle: number | null = null;
					let nearestDist = Infinity;
					let nearestX = 0;
					let nearestZ = 0;
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
						found = true;
						void _enemy;
					}

					if (found) {
						const lead = leadTarget(mountWorldX, mountWorldZ, nearestX, nearestZ, 0, 0, BULLET_SPEED);
						targetAngle = bearingXZ(mountWorldX, mountWorldZ, lead.x, lead.z);
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
			.setProcess(({ queries, ecs }) => {
				const now = performance.now();
				for (const { components: { turret } } of queries.turrets) {
					if (!turret.hasTarget) continue;
					if (now - turret.lastFiredAt < turret.fireIntervalMs) continue;

					const ship = ecs.getComponent(turret.ownerShipId, 'ship');
					const shipTransform = ecs.getComponent(turret.ownerShipId, 'localTransform3D');
					if (!ship || !shipTransform) continue;

					const { x: mountWorldX, z: mountWorldZ } = mountToWorld(
						shipTransform.x, shipTransform.z, ship.heading, turret.mountX, turret.mountZ,
					);

					const fwd = forwardXZ(turret.aimAngle);
					const muzzleX = mountWorldX + fwd.x * MUZZLE_OFFSET;
					const muzzleZ = mountWorldZ + fwd.z * MUZZLE_OFFSET;

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
