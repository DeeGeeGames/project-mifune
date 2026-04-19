import { definePlugin, type World } from '../types';
import { angleDiff, bearingXZ, clamp, distanceXZ, forwardXZ, leadTarget, mountToWorld, normalizeAngle, stepAngle } from '../math';
import { projectileMesh } from '../ships';
import { createMeshComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { canFire, recordShot } from '../weapons';
import {
	BULLET_LIFE_SEC,
	BULLET_SPEED,
	MUZZLE_OFFSET,
	TURRET_TURN_RATE,
} from '../constants';

interface OwnerState {
	readonly heading: number;
	readonly x: number;
	readonly z: number;
}

const getOwnerState = (ecs: World, ownerId: number): OwnerState | null => {
	const transform = ecs.getComponent(ownerId, 'localTransform3D');
	const kinematic = ecs.getComponent(ownerId, 'kinematic');
	if (!transform || !kinematic) return null;
	return { heading: kinematic.heading, x: transform.x, z: transform.z };
};

interface TargetCandidate {
	readonly x: number;
	readonly z: number;
}

export const createTurretPlugin = () => definePlugin({
	id: 'turret',
	install: (world) => {
		world.addSystem('turret-aim')
			.setPriority(210)
			.inPhase('update')
			.addQuery('turrets', { with: ['turret'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.addQuery('ships', { with: ['ship', 'localTransform3D'] })
			.setProcess(({ queries, dt, ecs }) => {
				for (const { components: { turret } } of queries.turrets) {
					const owner = getOwnerState(ecs, turret.ownerId);
					if (!owner) {
						turret.hasTarget = false;
						continue;
					}

					const { x: mountWorldX, z: mountWorldZ } = mountToWorld(
						owner.x, owner.z, owner.heading, turret.mountX, turret.mountZ,
					);
					const baseWorld = normalizeAngle(owner.heading + turret.baseAngle);

					const targets: readonly { readonly components: { readonly localTransform3D: TargetCandidate } }[] =
						turret.faction === 'ally' ? queries.enemies : queries.ships;

					let nearestDist = Infinity;
					let nearestX = 0;
					let nearestZ = 0;
					let found = false;

					for (const { components: { localTransform3D: et } } of targets) {
						const d = distanceXZ(mountWorldX, mountWorldZ, et.x, et.z);
						if (d > turret.range) continue;
						const ang = bearingXZ(mountWorldX, mountWorldZ, et.x, et.z);
						if (Math.abs(angleDiff(ang, baseWorld)) > turret.coneHalf) continue;
						if (d >= nearestDist) continue;
						nearestDist = d;
						nearestX = et.x;
						nearestZ = et.z;
						found = true;
					}

					if (!found) {
						turret.hasTarget = false;
						turret.aimAngle = stepAngle(turret.aimAngle, baseWorld, TURRET_TURN_RATE * dt);
						turret.mount.rotation.y = normalizeAngle(turret.aimAngle - owner.heading);
						continue;
					}

					const lead = leadTarget(mountWorldX, mountWorldZ, nearestX, nearestZ, 0, 0, BULLET_SPEED);
					const targetAngle = bearingXZ(mountWorldX, mountWorldZ, lead.x, lead.z);
					const diff = angleDiff(targetAngle, baseWorld);
					const clampedDiff = clamp(diff, -turret.coneHalf, turret.coneHalf);
					const clampedTarget = normalizeAngle(baseWorld + clampedDiff);
					turret.aimAngle = stepAngle(turret.aimAngle, clampedTarget, TURRET_TURN_RATE * dt);
					turret.mount.rotation.y = normalizeAngle(turret.aimAngle - owner.heading);

					turret.hasTarget = Math.abs(angleDiff(turret.aimAngle, clampedTarget)) < 0.05;
				}
			});

		world.addSystem('turret-fire')
			.setPriority(220)
			.inPhase('update')
			.addQuery('turrets', { with: ['turret', 'burstFire'] })
			.setProcess(({ queries, ecs }) => {
				const now = performance.now();
				for (const { components: { turret, burstFire } } of queries.turrets) {
					if (!turret.hasTarget) continue;
					if (!canFire(burstFire, now)) continue;

					const owner = getOwnerState(ecs, turret.ownerId);
					if (!owner) continue;

					const { x: mountWorldX, z: mountWorldZ } = mountToWorld(
						owner.x, owner.z, owner.heading, turret.mountX, turret.mountZ,
					);

					const fwd = forwardXZ(turret.aimAngle);
					const muzzleX = mountWorldX + fwd.x * MUZZLE_OFFSET;
					const muzzleZ = mountWorldZ + fwd.z * MUZZLE_OFFSET;

					ecs.spawn({
						...createMeshComponents(projectileMesh(), { x: muzzleX, y: 0.6, z: muzzleZ }, { rotation: { y: turret.aimAngle } }),
						projectile: {
							faction: turret.faction,
							vx: fwd.x * BULLET_SPEED,
							vz: fwd.z * BULLET_SPEED,
							life: BULLET_LIFE_SEC,
							damage: turret.damage,
						},
					});

					recordShot(burstFire, now);
				}
			});
	},
});
