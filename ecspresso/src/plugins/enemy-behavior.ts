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
import type { KinematicState } from '../kinematic';
import type { World, EnemyComponent, EnemyThreatSummary } from '../types';
import {
	GUNSHIP_RANGED_CONFIG,
	type RangedBehaviorConfig,
	type SniperAimConfig,
} from '../constants';

interface RangedBlackboard {
	readonly tier: PerceptionTier;
	readonly config: RangedBehaviorConfig;
	readonly sniperAim: SniperAimConfig | null;
}

interface RangedContext {
	readonly enemy: EnemyComponent;
	readonly kinematic: KinematicState;
	readonly ex: number;
	readonly ez: number;
	readonly snapshot: PlayerSnapshot;
	readonly threat: EnemyThreatSummary | null;
	readonly config: RangedBehaviorConfig;
	readonly sniperAim: SniperAimConfig | null;
}

const resolveContext = (btCtx: BehaviorTreeContext<RangedBlackboard>): RangedContext | null => {
	const ecs = btCtx.ecs as unknown as World;
	const enemy = ecs.getComponent(btCtx.entityId, 'enemy');
	const kinematic = ecs.getComponent(btCtx.entityId, 'kinematic');
	const transform = ecs.getComponent(btCtx.entityId, 'localTransform3D');
	if (!enemy || !kinematic || !transform) return null;
	const playerState = ecs.getResource('playerState');
	const carrierKinematic = ecs.getComponent(playerState.commandVesselId, 'kinematic');
	const carrierTransform = ecs.getComponent(playerState.commandVesselId, 'localTransform3D');
	if (!carrierKinematic || !carrierTransform) return null;
	const threat = ecs.getResource('threatMap').byEnemyId.get(btCtx.entityId) ?? null;
	return {
		enemy,
		kinematic,
		ex: transform.x,
		ez: transform.z,
		snapshot: getPlayerSnapshot(carrierKinematic, carrierTransform, btCtx.blackboard.tier),
		threat,
		config: btCtx.blackboard.config,
		sniperAim: btCtx.blackboard.sniperAim,
	};
};

const perceivedThreat = (enemy: EnemyComponent, threat: EnemyThreatSummary | null, config: RangedBehaviorConfig): number =>
	(threat?.staticDps ?? 0)
	+ (threat?.coneThreat ?? 0) * config.coneThreatWeight
	+ enemy.hitEscalation;

const isTooFar = condition<RangedBlackboard>('rangedTooFar', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return false;
	return distanceXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z)
		> g.config.preferredRange + g.config.rangeTolerance;
});

const isTooClose = condition<RangedBlackboard>('rangedTooClose', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return false;
	return distanceXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z)
		< g.config.preferredRange - g.config.rangeTolerance;
});

const closeDistance = action<RangedBlackboard>('rangedCloseDistance', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return NodeStatus.Failure;
	g.kinematic.headingTarget = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
	g.kinematic.throttle = 1;
	return NodeStatus.Success;
});

const openDistance = action<RangedBlackboard>('rangedOpenDistance', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return NodeStatus.Failure;
	const bearing = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
	g.kinematic.headingTarget = normalizeAngle(bearing + Math.PI);
	g.kinematic.throttle = 1;
	return NodeStatus.Success;
});

const holdPosition = action<RangedBlackboard>('rangedHold', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return NodeStatus.Failure;
	g.kinematic.headingTarget = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
	g.kinematic.throttle = g.config.holdThrottle;
	return NodeStatus.Success;
});

const threatOverTolerance = condition<RangedBlackboard>('rangedThreatOverTolerance', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return false;
	return perceivedThreat(g.enemy, g.threat, g.config) > g.enemy.threatTolerance;
});

const evade = action<RangedBlackboard>('rangedEvade', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return NodeStatus.Failure;
	const carrierBearing = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
	const threat = g.threat;
	if (!threat || threat.dominantTurretId === null) {
		g.kinematic.headingTarget = carrierBearing;
		g.kinematic.throttle = g.config.holdThrottle;
		return NodeStatus.Success;
	}
	const turretBearing = bearingXZ(g.ex, g.ez, threat.dominantTurretX, threat.dominantTurretZ);
	const rel = angleDiff(turretBearing, carrierBearing);
	const sign = rel > 0 ? -1 : 1;
	g.kinematic.headingTarget = normalizeAngle(carrierBearing + sign * g.config.evadeMaxOffset);
	g.kinematic.throttle = g.config.evadeThrottle;
	return NodeStatus.Success;
});

const carrierAimingAtSniper = condition<RangedBlackboard>('sniperCarrierAiming', (ctx) => {
	const g = resolveContext(ctx);
	if (!g || !g.sniperAim) return false;
	if (g.snapshot.tier !== 'predictive') return false;
	if (g.snapshot.throttle <= g.sniperAim.throttleThreshold) return false;
	const bearingFromCarrier = bearingXZ(g.snapshot.x, g.snapshot.z, g.ex, g.ez);
	return Math.abs(angleDiff(bearingFromCarrier, g.snapshot.heading)) < g.sniperAim.angleThreshold;
});

const preemptiveKite = action<RangedBlackboard>('sniperPreemptiveKite', (ctx) => {
	const g = resolveContext(ctx);
	if (!g) return NodeStatus.Failure;
	if (g.snapshot.tier !== 'predictive') return NodeStatus.Failure;
	const bearingFromCarrier = bearingXZ(g.snapshot.x, g.snapshot.z, g.ex, g.ez);
	const alpha = angleDiff(bearingFromCarrier, g.snapshot.heading);
	const sign = alpha >= 0 ? 1 : -1;
	g.kinematic.headingTarget = normalizeAngle(bearingFromCarrier + sign * Math.PI / 2);
	g.kinematic.throttle = 1;
	return NodeStatus.Success;
});

const DEFAULT_BLACKBOARD: RangedBlackboard = {
	tier: 'positional',
	config: GUNSHIP_RANGED_CONFIG,
	sniperAim: null,
};

export const RANGED_TREE = defineBehaviorTree<RangedBlackboard>('ranged', {
	blackboard: DEFAULT_BLACKBOARD,
	root: selector<RangedBlackboard>([
		sequence<RangedBlackboard>([threatOverTolerance, evade]),
		sequence<RangedBlackboard>([isTooFar, closeDistance]),
		sequence<RangedBlackboard>([isTooClose, openDistance]),
		holdPosition,
	]),
});

export const SNIPER_TREE = defineBehaviorTree<RangedBlackboard>('sniper', {
	blackboard: DEFAULT_BLACKBOARD,
	root: selector<RangedBlackboard>([
		sequence<RangedBlackboard>([threatOverTolerance, evade]),
		sequence<RangedBlackboard>([carrierAimingAtSniper, preemptiveKite]),
		sequence<RangedBlackboard>([isTooClose, openDistance]),
		sequence<RangedBlackboard>([isTooFar, closeDistance]),
		holdPosition,
	]),
});

export { createBehaviorTree };
export type { RangedBlackboard };
