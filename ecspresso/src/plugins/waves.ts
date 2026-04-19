import type { BehaviorTreeDefinition } from 'ecspresso/plugins/ai/behavior-tree';
import { definePlugin, type World } from '../types';
import { enemyShipGroup, turretFromMount } from '../ships';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { bearingXZ } from '../math';
import { ENEMY_KINDS, ENEMY_SPECS, makeBehavior, type EnemyBehavior, type EnemyKind } from '../enemies';
import { RANGED_TREE, SNIPER_TREE, createBehaviorTree, type RangedBlackboard } from './enemy-behavior';
import { buildHealthBar } from './healthBars';
import {
	BRAWLER_RANGED_CONFIG,
	CAMERA_VIEW_SIZE,
	CAMERA_ZOOM_MIN,
	ENEMY_SPAWN_RING_PAD,
	ENEMY_SPAWN_WEIGHTS,
	GUNSHIP_RANGED_CONFIG,
	SNIPER_AIM_CONFIG,
	SNIPER_RANGED_CONFIG,
	WAVE_MIN_INTERVAL_MS,
	WAVE_RAMP_SEC,
	WAVE_START_INTERVAL_MS,
	type RangedBehaviorConfig,
	type SniperAimConfig,
} from '../constants';

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
	const { group, turretMount } = enemyShipGroup(kind);
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
			heading: spawnHeading,
			headingTarget: spawnHeading,
			throttle: 0,
			vx: 0,
			vz: 0,
			turnRate: spec.turnRate,
			turnSpeed: 0,
			turnAccel: spec.turnAccel,
			accel: spec.accel,
			maxSpeed: spec.maxSpeed,
			drag: spec.drag,
			behavior,
		},
		healthBar,
		...(behaviorTree ?? {}),
	});

	if (isShooter && spec.turretMount && turretMount) {
		ecs.spawn({
			turret: turretFromMount(enemyEntity.id, 'enemy', spec.turretMount, turretMount),
		});
	}
};

export const createWavesPlugin = () => definePlugin({
	id: 'waves',
	install: (world) => {
		world.addResource('waveState', {
			timer: 0,
			spawnIntervalMs: WAVE_START_INTERVAL_MS,
			elapsedSec: 0,
			initialSeedDone: false,
		});

		world.addSystem('waves')
			.setPriority(100)
			.inPhase('update')
			.addQuery('flagship', { with: ['commandVessel', 'localTransform3D'] })
			.withResources(['waveState'])
			.setProcess(({ queries, dt, ecs, resources: { waveState } }) => {
				const flagship = queries.flagship[0];
				if (!flagship) return;

				const ft = flagship.components.localTransform3D;
				const radius = CAMERA_VIEW_SIZE / CAMERA_ZOOM_MIN + ENEMY_SPAWN_RING_PAD;

				if (!waveState.initialSeedDone) {
					ENEMY_KINDS.forEach((kind, i) => {
						const angle = (i / ENEMY_KINDS.length) * Math.PI * 2;
						const spawnX = ft.x + Math.sin(angle) * radius;
						const spawnZ = ft.z + Math.cos(angle) * radius;
						spawnEnemy(ecs, kind, spawnX, spawnZ, ft.x, ft.z);
					});
					waveState.initialSeedDone = true;
				}

				waveState.elapsedSec += dt;
				waveState.timer += dt * 1000;

				const rampT = Math.min(1, waveState.elapsedSec / WAVE_RAMP_SEC);
				waveState.spawnIntervalMs =
					WAVE_START_INTERVAL_MS + (WAVE_MIN_INTERVAL_MS - WAVE_START_INTERVAL_MS) * rampT;

				if (waveState.timer < waveState.spawnIntervalMs) return;
				waveState.timer -= waveState.spawnIntervalMs;

				const angle = Math.random() * Math.PI * 2;
				const spawnX = ft.x + Math.sin(angle) * radius;
				const spawnZ = ft.z + Math.cos(angle) * radius;
				spawnEnemy(ecs, pickKind(), spawnX, spawnZ, ft.x, ft.z);
			});
	},
});
