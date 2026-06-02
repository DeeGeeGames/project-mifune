import {
	createBehaviorTree,
	NodeStatus,
	selector,
	sequence,
	type BehaviorTreeContext,
	type BehaviorTreeDefinition,
	type BehaviorTreeHelpers,
} from 'ecspresso/plugins/ai/behavior-tree';
import { angleDiff, bearingXZ, distanceXZ, normalizeAngle } from '../math';
import { getPlayerSnapshot, type PerceptionTier, type PlayerSnapshot } from '../perception';
import type { KinematicState } from '../kinematic';
import type { World } from '../types';
import type { EnemyComponent, EnemyThreatSummary } from '../enemy-types';
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

const resolveContext = (btCtx: BehaviorTreeContext<RangedBlackboard, World>): RangedContext | null => {
	const ecs = btCtx.ecs;
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

const runWithContext = (
	ctx: BehaviorTreeContext<RangedBlackboard, World>,
	fn: (g: RangedContext) => NodeStatus,
): NodeStatus => {
	const g = resolveContext(ctx);
	return g ? fn(g) : NodeStatus.Failure;
};

const checkWithContext = (
	ctx: BehaviorTreeContext<RangedBlackboard, World>,
	fn: (g: RangedContext) => boolean,
): boolean => {
	const g = resolveContext(ctx);
	return g ? fn(g) : false;
};

const DEFAULT_BLACKBOARD: RangedBlackboard = {
	tier: 'positional',
	config: GUNSHIP_RANGED_CONFIG,
	sniperAim: null,
};

export interface RangedBehaviorTrees {
	readonly ranged: BehaviorTreeDefinition<RangedBlackboard>;
	readonly sniper: BehaviorTreeDefinition<RangedBlackboard>;
}

export const createRangedBehaviorTrees = (helpers: BehaviorTreeHelpers<World>): RangedBehaviorTrees => {
	const { action, condition, defineBehaviorTree } = helpers;

	const isTooFar = condition<RangedBlackboard>('rangedTooFar', (ctx) =>
		checkWithContext(ctx, (g) =>
			distanceXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z) > g.config.preferredRange + g.config.rangeTolerance));

	const isTooClose = condition<RangedBlackboard>('rangedTooClose', (ctx) =>
		checkWithContext(ctx, (g) =>
			distanceXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z) < g.config.preferredRange - g.config.rangeTolerance));

	const closeDistance = action<RangedBlackboard>('rangedCloseDistance', (ctx) =>
		runWithContext(ctx, (g) => {
			g.kinematic.headingTarget = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
			g.kinematic.throttle = 1;
			return NodeStatus.Success;
		}));

	const openDistance = action<RangedBlackboard>('rangedOpenDistance', (ctx) =>
		runWithContext(ctx, (g) => {
			const bearing = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
			g.kinematic.headingTarget = normalizeAngle(bearing + Math.PI);
			g.kinematic.throttle = 1;
			return NodeStatus.Success;
		}));

	const holdPosition = action<RangedBlackboard>('rangedHold', (ctx) =>
		runWithContext(ctx, (g) => {
			g.kinematic.headingTarget = bearingXZ(g.ex, g.ez, g.snapshot.x, g.snapshot.z);
			g.kinematic.throttle = g.config.holdThrottle;
			return NodeStatus.Success;
		}));

	const threatOverTolerance = condition<RangedBlackboard>('rangedThreatOverTolerance', (ctx) =>
		checkWithContext(ctx, (g) => perceivedThreat(g.enemy, g.threat, g.config) > g.enemy.threatTolerance));

	const evade = action<RangedBlackboard>('rangedEvade', (ctx) =>
		runWithContext(ctx, (g) => {
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
		}));

	const carrierAimingAtSniper = condition<RangedBlackboard>('sniperCarrierAiming', (ctx) =>
		checkWithContext(ctx, (g) => {
			if (!g.sniperAim || g.snapshot.tier !== 'predictive' || g.snapshot.throttle <= g.sniperAim.throttleThreshold) {
				return false;
			}
			const bearingFromCarrier = bearingXZ(g.snapshot.x, g.snapshot.z, g.ex, g.ez);
			return Math.abs(angleDiff(bearingFromCarrier, g.snapshot.heading)) < g.sniperAim.angleThreshold;
		}));

	const preemptiveKite = action<RangedBlackboard>('sniperPreemptiveKite', (ctx) =>
		runWithContext(ctx, (g) => {
			if (g.snapshot.tier !== 'predictive') return NodeStatus.Failure;
			const bearingFromCarrier = bearingXZ(g.snapshot.x, g.snapshot.z, g.ex, g.ez);
			const alpha = angleDiff(bearingFromCarrier, g.snapshot.heading);
			const sign = alpha >= 0 ? 1 : -1;
			g.kinematic.headingTarget = normalizeAngle(bearingFromCarrier + sign * Math.PI / 2);
			g.kinematic.throttle = 1;
			return NodeStatus.Success;
		}));

	const evadeBranch = sequence<RangedBlackboard>([threatOverTolerance, evade]);
	const closeBranch = sequence<RangedBlackboard>([isTooClose, openDistance]);
	const farBranch = sequence<RangedBlackboard>([isTooFar, closeDistance]);
	const kiteBranch = sequence<RangedBlackboard>([carrierAimingAtSniper, preemptiveKite]);

	return {
		ranged: defineBehaviorTree<RangedBlackboard>('ranged', {
			blackboard: DEFAULT_BLACKBOARD,
			root: selector<RangedBlackboard>([evadeBranch, farBranch, closeBranch, holdPosition]),
		}),
		sniper: defineBehaviorTree<RangedBlackboard>('sniper', {
			blackboard: DEFAULT_BLACKBOARD,
			root: selector<RangedBlackboard>([evadeBranch, kiteBranch, closeBranch, farBranch, holdPosition]),
		}),
	};
};

export { createBehaviorTree };
export type { RangedBlackboard };
