import { definePlugin } from '../types';
import { enemyShipGroup, turretFromMount } from '../ships';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { bearingXZ } from '../math';
import { ENEMY_KINDS, ENEMY_SPECS, makeBehavior, type EnemyKind } from '../enemies';
import { GUNSHIP_TREE, createBehaviorTree } from './enemy-behavior';
import {
	ENEMY_SPAWN_RING_PAD,
	ENEMY_SPAWN_WEIGHTS,
	CAMERA_VIEW_SIZE,
	CAMERA_ZOOM_MIN,
	WAVE_MIN_INTERVAL_MS,
	WAVE_RAMP_SEC,
	WAVE_START_INTERVAL_MS,
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

export const createWavesPlugin = () => definePlugin({
	id: 'waves',
	install: (world) => {
		world.addResource('waveState', {
			timer: 0,
			spawnIntervalMs: WAVE_START_INTERVAL_MS,
			elapsedSec: 0,
		});

		world.addSystem('waves')
			.setPriority(100)
			.inPhase('update')
			.addQuery('flagship', { with: ['commandVessel', 'localTransform3D'] })
			.withResources(['waveState'])
			.setProcess(({ queries, dt, ecs, resources: { waveState } }) => {
				const flagship = queries.flagship[0];
				if (!flagship) return;

				waveState.elapsedSec += dt;
				waveState.timer += dt * 1000;

				const rampT = Math.min(1, waveState.elapsedSec / WAVE_RAMP_SEC);
				waveState.spawnIntervalMs =
					WAVE_START_INTERVAL_MS + (WAVE_MIN_INTERVAL_MS - WAVE_START_INTERVAL_MS) * rampT;

				if (waveState.timer < waveState.spawnIntervalMs) return;
				waveState.timer -= waveState.spawnIntervalMs;

				const ft = flagship.components.localTransform3D;
				const angle = Math.random() * Math.PI * 2;
				const radius = CAMERA_VIEW_SIZE / CAMERA_ZOOM_MIN + ENEMY_SPAWN_RING_PAD;
				const spawnX = ft.x + Math.sin(angle) * radius;
				const spawnZ = ft.z + Math.cos(angle) * radius;
				const spawnHeading = bearingXZ(spawnX, spawnZ, ft.x, ft.z);

				const kind = pickKind();
				const spec = ENEMY_SPECS[kind];
				const { group, turretMount } = enemyShipGroup(kind);

				const behavior = makeBehavior(kind);
				const isShooter = spec.turretMount !== undefined && turretMount !== null;

				const enemySpawn = {
					...createGroupComponents(
						group,
						{ x: spawnX, y: 0, z: spawnZ },
						{ rotation: { y: spawnHeading } },
					),
					enemy: {
						hp: spec.hp,
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
					...(isShooter && behavior.kind === 'gunship'
						? createBehaviorTree(GUNSHIP_TREE, { tier: behavior.perceptionTier })
						: {}),
				};

				const enemyEntity = ecs.spawn(enemySpawn);

				if (isShooter && spec.turretMount && turretMount) {
					ecs.spawn({
						turret: turretFromMount(enemyEntity.id, 'enemy', spec.turretMount, turretMount),
					});
				}
			});
	},
});
