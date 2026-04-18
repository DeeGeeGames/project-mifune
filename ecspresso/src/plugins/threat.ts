import { definePlugin } from '../types';
import { angleDiff, bearingXZ, distanceXZ, mountToWorld, normalizeAngle } from '../math';

interface TurretSnapshot {
	readonly id: number;
	readonly x: number;
	readonly z: number;
	readonly baseWorld: number;
	readonly coneHalf: number;
	readonly range: number;
	readonly dps: number;
}

export const createThreatPlugin = () => definePlugin({
	id: 'threat',
	install: (world) => {
		world.addResource('threatMap', { byEnemyId: new Map() });

		world.addSystem('threat-scan')
			.setPriority(205)
			.inPhase('update')
			.addQuery('turrets', { with: ['turret'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.withResources(['threatMap'])
			.setProcess(({ queries, ecs, resources: { threatMap } }) => {
				threatMap.byEnemyId.clear();

				const allyTurrets: TurretSnapshot[] = queries.turrets.flatMap(({ id, components: { turret } }) => {
					if (turret.faction !== 'ally') return [];
					const ownerTransform = ecs.getComponent(turret.ownerId, 'localTransform3D');
					const ownerShip = ecs.getComponent(turret.ownerId, 'ship');
					if (!ownerTransform || !ownerShip) return [];
					const { x, z } = mountToWorld(
						ownerTransform.x, ownerTransform.z, ownerShip.heading, turret.mountX, turret.mountZ,
					);
					return [{
						id,
						x,
						z,
						baseWorld: normalizeAngle(ownerShip.heading + turret.baseAngle),
						coneHalf: turret.coneHalf,
						range: turret.range,
						dps: turret.damage * (1000 / turret.fireIntervalMs),
					}];
				});

				if (allyTurrets.length === 0) return;

				for (const { id: enemyId, components: { localTransform3D: et } } of queries.enemies) {
					let staticDps = 0;
					let dominantTurretId: number | null = null;
					let dominantTurretX = 0;
					let dominantTurretZ = 0;
					let dominantDps = 0;

					for (const t of allyTurrets) {
						const d = distanceXZ(t.x, t.z, et.x, et.z);
						if (d > t.range) continue;
						const ang = bearingXZ(t.x, t.z, et.x, et.z);
						if (Math.abs(angleDiff(ang, t.baseWorld)) > t.coneHalf) continue;

						staticDps += t.dps;
						if (t.dps > dominantDps) {
							dominantDps = t.dps;
							dominantTurretId = t.id;
							dominantTurretX = t.x;
							dominantTurretZ = t.z;
						}
					}

					if (staticDps > 0) {
						threatMap.byEnemyId.set(enemyId, {
							staticDps,
							dominantTurretId,
							dominantTurretX,
							dominantTurretZ,
						});
					}
				}
			});
	},
});
