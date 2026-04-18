import { definePlugin } from '../types';
import { enemyShipGroup } from '../ships';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { bearingXZ } from '../math';
import {
	ENEMY_HP,
	ENEMY_TURN_RATE,
	ENEMY_TURN_ACCEL,
	ENEMY_ACCEL,
	ENEMY_MAX_SPEED,
	ENEMY_DRAG,
	ENEMY_SPAWN_RING_PAD,
	CAMERA_VIEW_SIZE,
	WAVE_MIN_INTERVAL_MS,
	WAVE_RAMP_SEC,
	WAVE_START_INTERVAL_MS,
} from '../constants';

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

				ecs.spawn({
					...createGroupComponents(
						enemyShipGroup(),
						{ x: spawnX, y: 0, z: spawnZ },
						{ rotation: { y: spawnHeading } },
					),
					enemy: {
						hp: ENEMY_HP,
						heading: spawnHeading,
						headingTarget: spawnHeading,
						throttle: 0,
						vx: 0,
						vz: 0,
						turnRate: ENEMY_TURN_RATE,
						turnSpeed: 0,
						turnAccel: ENEMY_TURN_ACCEL,
						accel: ENEMY_ACCEL,
						maxSpeed: ENEMY_MAX_SPEED,
						drag: ENEMY_DRAG,
					},
				});
			});
	},
});
