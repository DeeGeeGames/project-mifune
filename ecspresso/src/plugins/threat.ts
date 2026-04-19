import { definePlugin } from '../types';
import { angleDiff, bearingXZ, distanceXZ, mountToWorld, normalizeAngle } from '../math';
import { CONE_APPROACH_ANGLE_MULTIPLIER, CONE_APPROACH_RANGE_MULTIPLIER } from '../constants';

interface TurretSnapshot {
	readonly id: number;
	readonly x: number;
	readonly z: number;
	readonly baseWorld: number;
	readonly coneHalf: number;
	readonly range: number;
	readonly dps: number;
}

interface ThreatAccumulator {
	readonly staticDps: number;
	readonly coneThreat: number;
	readonly dominantTurretId: number | null;
	readonly dominantTurretX: number;
	readonly dominantTurretZ: number;
	readonly dominantEffectiveDps: number;
}

const INITIAL_ACC: ThreatAccumulator = {
	staticDps: 0,
	coneThreat: 0,
	dominantTurretId: null,
	dominantTurretX: 0,
	dominantTurretZ: 0,
	dominantEffectiveDps: 0,
} as const;

// Floor below which a turret's discounted contribution is dropped. Without this, diagonal-
// corner enemies would write into the threat map for near-zero DPS, inflating Map size in
// late waves when most active enemies sit inside *some* turret's widened band.
const APPROACH_NOISE_FLOOR = 1 / 128;

const fractionInBand = (value: number, innerBound: number, multiplier: number): number =>
	1 - (value - innerBound) / (innerBound * (multiplier - 1));

const contributeFrom = (ex: number, ez: number) =>
	(acc: ThreatAccumulator, t: TurretSnapshot): ThreatAccumulator => {
		const d = distanceXZ(t.x, t.z, ex, ez);
		if (d > t.range * CONE_APPROACH_RANGE_MULTIPLIER) return acc;

		const dAng = Math.abs(angleDiff(bearingXZ(t.x, t.z, ex, ez), t.baseWorld));
		if (dAng > t.coneHalf * CONE_APPROACH_ANGLE_MULTIPLIER) return acc;

		const inRange = d <= t.range;
		const inCone = dAng <= t.coneHalf;
		const radialFraction = inRange ? 1 : fractionInBand(d, t.range, CONE_APPROACH_RANGE_MULTIPLIER);
		const angularFraction = inCone ? 1 : fractionInBand(dAng, t.coneHalf, CONE_APPROACH_ANGLE_MULTIPLIER);
		const approachFraction = radialFraction * angularFraction;
		if (!(inRange && inCone) && approachFraction < APPROACH_NOISE_FLOOR) return acc;

		const effectiveDps = t.dps * approachFraction;
		const isDominant = effectiveDps > acc.dominantEffectiveDps;
		const inKillZone = inRange && inCone;
		return {
			staticDps: acc.staticDps + (inKillZone ? t.dps : 0),
			coneThreat: acc.coneThreat + (inKillZone ? 0 : effectiveDps),
			dominantTurretId: isDominant ? t.id : acc.dominantTurretId,
			dominantTurretX: isDominant ? t.x : acc.dominantTurretX,
			dominantTurretZ: isDominant ? t.z : acc.dominantTurretZ,
			dominantEffectiveDps: isDominant ? effectiveDps : acc.dominantEffectiveDps,
		};
	};

export const createThreatPlugin = () => definePlugin({
	id: 'threat',
	install: (world) => {
		world.addResource('threatMap', { byEnemyId: new Map() });

		world.addSystem('threat-scan')
			.setPriority(205)
			.inPhase('update')
			.addQuery('turrets', { with: ['turret', 'burstFire'] })
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.withResources(['threatMap'])
			.setProcess(({ queries, ecs, resources: { threatMap } }) => {
				threatMap.byEnemyId.clear();

				const allyTurrets: TurretSnapshot[] = queries.turrets.flatMap(({ id, components: { turret, burstFire } }) => {
					if (turret.faction !== 'ally') return [];
					const ownerTransform = ecs.getComponent(turret.ownerId, 'localTransform3D');
					const ownerKinematic = ecs.getComponent(turret.ownerId, 'kinematic');
					if (!ownerTransform || !ownerKinematic) return [];
					const { x, z } = mountToWorld(
						ownerTransform.x, ownerTransform.z, ownerKinematic.heading, turret.mountX, turret.mountZ,
					);
					return [{
						id,
						x,
						z,
						baseWorld: normalizeAngle(ownerKinematic.heading + turret.baseAngle),
						coneHalf: turret.coneHalf,
						range: turret.range,
						dps: turret.damage * (1000 / burstFire.fireIntervalMs),
					}];
				});

				if (allyTurrets.length === 0) return;

				queries.enemies.forEach(({ id: enemyId, components: { localTransform3D: et } }) => {
					const acc = allyTurrets.reduce(contributeFrom(et.x, et.z), INITIAL_ACC);

					if (acc.staticDps === 0 && acc.coneThreat === 0) return;

					threatMap.byEnemyId.set(enemyId, {
						staticDps: acc.staticDps,
						coneThreat: acc.coneThreat,
						dominantTurretId: acc.dominantTurretId,
						dominantTurretX: acc.dominantTurretX,
						dominantTurretZ: acc.dominantTurretZ,
					});
				});
			});
	},
});
