import type { BehaviorTreeDefinition } from 'ecspresso/plugins/ai/behavior-tree';
import { definePlugin, type World } from '../types';
import { enemyShipGroup, turretFromMount } from '../ships';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { bearingXZ } from '../math';
import { ENEMY_KINDS, ENEMY_SPECS, makeBehavior, type EnemyBehavior, type EnemyKind } from '../enemies';
import { createKinematicState } from '../kinematic';
import { makeCollider } from '../collider';
import { RANGED_TREE, SNIPER_TREE, createBehaviorTree, type RangedBlackboard } from './enemy-behavior';
import { buildHealthBar } from './healthBars';
import {
	BRAWLER_RANGED_CONFIG,
	CAMERA_VIEW_SIZE,
	CAMERA_ZOOM_MIN,
	ENEMY_SPAWN_ANGLE_CENTER,
	ENEMY_SPAWN_ANGLE_SPREAD,
	ENEMY_SPAWN_DISTANCE_SCALE,
	ENEMY_SPAWN_RING_PAD,
	ENEMY_SPAWN_WEIGHTS,
	GUNSHIP_RANGED_CONFIG,
	SNIPER_AIM_CONFIG,
	SNIPER_RANGED_CONFIG,
	TRAIL_COLOR_ENEMY,
	type RangedBehaviorConfig,
	type SniperAimConfig,
} from '../constants';
import { spawnShipTrails } from './trail';

const TOTAL_WEIGHT = ENEMY_KINDS.reduce((sum, kind) => sum + ENEMY_SPAWN_WEIGHTS[kind], 0);

const pickKind = (): EnemyKind => {
	const roll = Math.random() * TOTAL_WEIGHT;
	let acc = 0;
	for (const kind of ENEMY_KINDS) {
		acc += ENEMY_SPAWN_WEIGHTS[kind];
		if (roll < acc) return kind;
	}
	return 'pursuer';
};

type ShooterBehavior = Extract<EnemyBehavior, { kind: 'gunship' | 'brawler' | 'sniper' }>;

interface ShooterTreeSpec {
	readonly tree: BehaviorTreeDefinition<RangedBlackboard>;
	readonly config: RangedBehaviorConfig;
	readonly sniperAim: SniperAimConfig | null;
}

const SHOOTER_TREES: Record<ShooterBehavior['kind'], ShooterTreeSpec> = {
	gunship: { tree: RANGED_TREE, config: GUNSHIP_RANGED_CONFIG, sniperAim: null },
	brawler: { tree: RANGED_TREE, config: BRAWLER_RANGED_CONFIG, sniperAim: null },
	sniper: { tree: SNIPER_TREE, config: SNIPER_RANGED_CONFIG, sniperAim: SNIPER_AIM_CONFIG },
};

const isShooterBehavior = (b: EnemyBehavior): b is ShooterBehavior => b.kind in SHOOTER_TREES;

const behaviorTreeFor = (behavior: EnemyBehavior) => {
	if (!isShooterBehavior(behavior)) return null;
	const { tree, config, sniperAim } = SHOOTER_TREES[behavior.kind];
	return createBehaviorTree(tree, { tier: behavior.perceptionTier, config, sniperAim });
};

const spawnEnemy = (ecs: World, kind: EnemyKind, spawnX: number, spawnZ: number, targetX: number, targetZ: number): void => {
	const spec = ENEMY_SPECS[kind];
	const built = enemyShipGroup(kind);
	const { group, turretMount } = built;
	const behavior = makeBehavior(kind);
	const isShooter = spec.turretMount !== undefined && turretMount !== null;
	const behaviorTree = behaviorTreeFor(behavior);
	const spawnHeading = bearingXZ(spawnX, spawnZ, targetX, targetZ);

	const healthBar = buildHealthBar({
		parent: group,
		hullLength: spec.hullLength,
		hullHeight: spec.hullHeight,
	});

	const enemyEntity = ecs.spawn({
		...createGroupComponents(
			group,
			{ x: spawnX, y: 0, z: spawnZ },
			{ rotation: { y: spawnHeading } },
		),
		enemy: {
			hp: spec.hp,
			maxHp: spec.hp,
			radius: spec.radius,
			threatTolerance: spec.threatTolerance ?? Infinity,
			hitEscalation: 0,
			behavior,
		},
		kinematic: createKinematicState(spec, spawnHeading),
		collider: makeCollider(spec),
		healthBar,
		engineGlow: { material: built.engineMaterial, mounts: built.engineMounts },
		...(behaviorTree ?? {}),
	}, { scope: 'playing' });

	spawnShipTrails(ecs, enemyEntity.id, built.engineMounts, TRAIL_COLOR_ENEMY);

	if (isShooter && spec.turretMount && turretMount) {
		ecs.spawn({
			...turretFromMount(enemyEntity.id, 'enemy', spec.turretMount, turretMount),
		}, { scope: 'playing' });
	}
};

export const createWavesPlugin = () => definePlugin({
	id: 'waves',
	install: (world) => {
		world.addSystem('waves-stats-init')
			.setOnInitialize((ecs) => {
				ecs.eventBus.subscribe('enemy:killed', () => {
					const state = ecs.tryGetScreenState('playing');
					if (state) state.kills += 1;
				});
				ecs.eventBus.subscribe('pickup:collected', ({ value }) => {
					const state = ecs.tryGetScreenState('playing');
					if (state) state.resourcesCollected += value;
				});
			});

		world.addSystem('waves')
			.setPriority(100)
			.inPhase('update')
			.inScreens(['playing'])
			.addSingleton('flagship', { with: ['commandVessel', 'localTransform3D'] })
			.setProcess(({ queries, dt, ecs }) => {
				const flagship = queries.flagship;
				if (!flagship) return;

				const state = ecs.getScreenState('playing');
				state.phaseTimer -= dt;

				if (state.phaseTimer <= 0) {
					state.phaseTimer = 0;
					void ecs.setScreen('waveSummary', {
						waveNumber: state.waveNumber,
						kills: state.kills,
						resourcesCollected: state.resourcesCollected,
					});
					return;
				}

				state.spawnTimer += dt * 1000;
				if (state.spawnTimer < state.spawnIntervalMs) return;
				state.spawnTimer -= state.spawnIntervalMs;

				const ft = flagship.components.localTransform3D;
				const radius = (CAMERA_VIEW_SIZE / CAMERA_ZOOM_MIN) * ENEMY_SPAWN_DISTANCE_SCALE + ENEMY_SPAWN_RING_PAD;
				const angle = ENEMY_SPAWN_ANGLE_CENTER + (Math.random() - 0.5) * ENEMY_SPAWN_ANGLE_SPREAD;
				const spawnX = ft.x + Math.sin(angle) * radius;
				const spawnZ = ft.z + Math.cos(angle) * radius;
				spawnEnemy(ecs, pickKind(), spawnX, spawnZ, ft.x, ft.z);
			});
	},
});
