import {
	action,
	condition,
	createBehaviorTree,
	defineBehaviorTree,
	NodeStatus,
	selector,
	sequence,
	type BehaviorTreeContext,
} from 'ecspresso/plugins/ai/behavior-tree';
import { angleDiff, bearingXZ, distanceXZ, normalizeAngle } from '../math';
import { getPlayerSnapshot, type PerceptionTier, type PlayerSnapshot } from '../perception';
import type { World, EnemyComponent, EnemyThreatSummary } from '../types';
import {
	GUNSHIP_EVADE_MAX_OFFSET,
	GUNSHIP_EVADE_THROTTLE,
	GUNSHIP_HOLD_THROTTLE,
	GUNSHIP_PREFERRED_RANGE,
	GUNSHIP_RANGE_TOLERANCE,
} from '../constants';

interface GunshipBlackboard {
	tier: PerceptionTier;
}

interface GunshipContext {
	readonly enemy: EnemyComponent;
	readonly ex: number;
	readonly ez: number;
	readonly snapshot: PlayerSnapshot;
	readonly threat: EnemyThreatSummary | null;
}

const resolveContext = (btCtx: BehaviorTreeContext<GunshipBlackboard>): GunshipContext | null => {
	const ecs = btCtx.ecs as unknown as World;
	const enemy = ecs.getComponent(btCtx.entityId, 'enemy');
	const transform = ecs.getComponent(btCtx.entityId, 'localTransform3D');
	if (!enemy || !transform) return null;
	const playerState = ecs.getResource('playerState');
	const carrierShip = ecs.getComponent(playerState.commandVesselId, 'ship');
	const carrierTransform = ecs.getComponent(playerState.commandVesselId, 'localTransform3D');
	if (!carrierShip || !carrierTransform) return null;
	const threat = ecs.getResource('threatMap').byEnemyId.get(btCtx.entityId) ?? null;
	return {
		enemy,
		ex: transform.x,
		ez: transform.z,
		snapshot: getPlayerSnapshot(carrierShip, carrierTransform, btCtx.blackboard.tier),
		threat,
	};
};

const perceivedThreat = (enemy: EnemyComponent, threat: EnemyThreatSummary | null): number =>
	(threat?.staticDps ?? 0) + enemy.hitEscalation;

const isTooFar = condition<GunshipBlackboard>('gunshipTooFar', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return false;
	return distanceXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z)
		> GUNSHIP_PREFERRED_RANGE + GUNSHIP_RANGE_TOLERANCE;
});

const isTooClose = condition<GunshipBlackboard>('gunshipTooClose', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return false;
	return distanceXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z)
		< GUNSHIP_PREFERRED_RANGE - GUNSHIP_RANGE_TOLERANCE;
});

const closeDistance = action<GunshipBlackboard>('gunshipCloseDistance', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return NodeStatus.Failure;
	g.enemy.headingTarget = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
	g.enemy.throttle = 1;
	return NodeStatus.Success;
});

const openDistance = action<GunshipBlackboard>('gunshipOpenDistance', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return NodeStatus.Failure;
	const bearing = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
	g.enemy.headingTarget = normalizeAngle(bearing + Math.PI);
	g.enemy.throttle = 1;
	return NodeStatus.Success;
});

const holdPosition = action<GunshipBlackboard>('gunshipHold', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return NodeStatus.Failure;
	g.enemy.headingTarget = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
	g.enemy.throttle = GUNSHIP_HOLD_THROTTLE;
	return NodeStatus.Success;
});

const threatOverTolerance = condition<GunshipBlackboard>('gunshipThreatOverTolerance', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return false;
	return perceivedThreat(g.enemy, g.threat) > g.enemy.threatTolerance;
});

const evade = action<GunshipBlackboard>('gunshipEvade', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return NodeStatus.Failure;
	const carrierBearing = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
	const threat = g.threat;
	if (!threat || threat.dominantTurretId === null) {
		g.enemy.headingTarget = carrierBearing;
		g.enemy.throttle = GUNSHIP_HOLD_THROTTLE;
		return NodeStatus.Success;
	}
	const turretBearing = bearingXZ(g.ex, g.ez, threat.dominantTurretX, threat.dominantTurretZ);
	const rel = angleDiff(turretBearing, carrierBearing);
	const sign = rel > 0 ? -1 : 1;
	g.enemy.headingTarget = normalizeAngle(carrierBearing + sign * GUNSHIP_EVADE_MAX_OFFSET);
	g.enemy.throttle = GUNSHIP_EVADE_THROTTLE;
	return NodeStatus.Success;
});

export const GUNSHIP_TREE = defineBehaviorTree<GunshipBlackboard>('gunship', {
	blackboard: { tier: 'positional' },
	root: selector<GunshipBlackboard>([
		sequence<GunshipBlackboard>([threatOverTolerance, evade]),
		sequence<GunshipBlackboard>([isTooFar, closeDistance]),
		sequence<GunshipBlackboard>([isTooClose, openDistance]),
		holdPosition,
	]),
});

export { createBehaviorTree };
