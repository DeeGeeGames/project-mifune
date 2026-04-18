import { definePlugin } from '../types';
import { enemyShipGroup } from '../ships';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { bearingXZ } from '../math';
import { ENEMY_KINDS, ENEMY_SPECS, makeBehavior } from '../enemies';
import {
	ENEMY_SPAWN_RING_PAD,
	CAMERA_VIEW_SIZE,
	WAVE_MIN_INTERVAL_MS,
	WAVE_RAMP_SEC,
	WAVE_START_INTERVAL_MS,
} from '../constants';

const pickKind = () => ENEMY_KINDS[Math.floor(Math.random() * ENEMY_KINDS.length)] ?? 'pursuer';

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
				const radius = CAMERA_VIEW_SIZE + ENEMY_SPAWN_RING_PAD;
				const spawnX = ft.x + Math.sin(angle) * radius;
				const spawnZ = ft.z + Math.cos(angle) * radius;
				const spawnHeading = bearingXZ(spawnX, spawnZ, ft.x, ft.z);

				const kind = pickKind();
				const spec = ENEMY_SPECS[kind];

				ecs.spawn({
					...createGroupComponents(
						enemyShipGroup(kind),
						{ x: spawnX, y: 0, z: spawnZ },
						{ rotation: { y: spawnHeading } },
					),
					enemy: {
						hp: spec.hp,
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
						behavior: makeBehavior(kind),
					},
				});
			});
	},
});
