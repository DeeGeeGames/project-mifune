import { definePlugin, type World, type ProjectileKind } from '../types';
import { createMeshComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { createTweenSequence } from 'ecspresso/plugins/scripting/tween';
import { createExplosionMesh, createImpactSparkMesh, createMuzzleFlashMesh } from '../ships';
import {
	DEATH_EXPLOSION_COLOR_ENEMY,
	DEATH_EXPLOSION_COLOR_SHIP,
	DEATH_EXPLOSION_CORE_COLOR,
	DEATH_EXPLOSION_CORE_LIFE_RATIO,
	DEATH_EXPLOSION_LIFE_SEC,
	DEATH_EXPLOSION_SCALE_MULT,
	ENGINE_EMISSIVE_IDLE,
	ENGINE_EMISSIVE_MAX,
	ENGINE_PLUME_LENGTH_IDLE,
	ENGINE_PLUME_LENGTH_MAX,
	ENGINE_PLUME_OPACITY_IDLE,
	ENGINE_PLUME_OPACITY_MAX,
	ENGINE_PLUME_WIDTH_MULT,
	IMPACT_SPARK_LIFE_SEC,
	IMPACT_TINT,
	MUZZLE_FLASH_LIFE_SEC,
	MUZZLE_TINT,
	SHIP_DEATH_EXPLOSION_LIFE_SEC,
	SHIP_DEATH_EXPLOSION_SCALE_MULT,
} from '../constants';
import type { MeshBasicMaterial } from 'three';

export type FxKind = ProjectileKind | 'missile';

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

const spawnFade = (
	ecs: World,
	mesh: Parameters<typeof createMeshComponents>[0],
	position: { x: number; y: number; z: number },
	rotationY: number,
	scaleStart: number,
	scaleEnd: number,
	material: MeshBasicMaterial,
	life: number,
): void => {
	ecs.spawn({
		...createMeshComponents(mesh, position, { rotation: { y: rotationY }, scale: scaleStart }),
		materialFade: { material },
		...createTweenSequence([{
			targets: [
				{ component: 'localTransform3D', field: 'sx', to: scaleEnd },
				{ component: 'localTransform3D', field: 'sy', to: scaleEnd },
				{ component: 'localTransform3D', field: 'sz', to: scaleEnd },
				{ component: 'materialFade', field: 'material.opacity', to: 0 },
			],
			duration: life,
			easing: easeOutQuad,
		}], {
			onComplete: ({ entityId }) => {
				material.dispose();
				ecs.removeEntity(entityId);
			},
		}),
	}, { scope: 'playing' });
};

export const spawnMuzzleFlash = (
	ecs: World,
	x: number,
	z: number,
	angle: number,
	kind: FxKind,
): void => {
	const { mesh, material } = createMuzzleFlashMesh(MUZZLE_TINT[kind]);
	spawnFade(ecs, mesh, { x, y: 0.6, z }, angle, 1, 1.6, material, MUZZLE_FLASH_LIFE_SEC);
};

export const spawnImpactSpark = (
	ecs: World,
	x: number,
	z: number,
	kind: FxKind,
): void => {
	const { mesh, material } = createImpactSparkMesh(IMPACT_TINT[kind]);
	spawnFade(ecs, mesh, { x, y: 0.6, z }, 0, 0.6, 1.8, material, IMPACT_SPARK_LIFE_SEC);
};

export const spawnDeathExplosion = (
	ecs: World,
	x: number,
	z: number,
	radius: number,
	target: 'enemy' | 'ship',
): void => {
	const life = target === 'ship' ? SHIP_DEATH_EXPLOSION_LIFE_SEC : DEATH_EXPLOSION_LIFE_SEC;
	const scaleMult = target === 'ship' ? SHIP_DEATH_EXPLOSION_SCALE_MULT : DEATH_EXPLOSION_SCALE_MULT;
	const tint = target === 'ship' ? DEATH_EXPLOSION_COLOR_SHIP : DEATH_EXPLOSION_COLOR_ENEMY;

	const outer = createExplosionMesh(tint, 0.8);
	spawnFade(ecs, outer.mesh, { x, y: 0.5, z }, 0, radius * 0.8, radius * scaleMult, outer.material, life);

	const coreLife = life * DEATH_EXPLOSION_CORE_LIFE_RATIO;
	const core = createExplosionMesh(DEATH_EXPLOSION_CORE_COLOR, 1.0);
	spawnFade(ecs, core.mesh, { x, y: 0.5, z }, 0, radius * 0.45, radius * 1.4, core.material, coreLife);
};

export const createVfxPlugin = () => definePlugin({
	id: 'vfx',
	install: (world) => {
		world.addSystem('engine-glow')
			.setPriority(205)
			.inPhase('update')
			.inScreens(['playing'])
			.setProcessEach({ with: ['engineGlow', 'kinematic'] }, ({ entity: { components: { engineGlow, kinematic } } }) => {
				const speedRatio = Math.min(1, Math.hypot(kinematic.vx, kinematic.vz) / kinematic.maxSpeed);
				const throttleMag = Math.min(1, Math.abs(kinematic.throttle));
				const t = Math.min(1, throttleMag * 0.7 + speedRatio * 0.3);
				engineGlow.material.emissiveIntensity = ENGINE_EMISSIVE_IDLE + (ENGINE_EMISSIVE_MAX - ENGINE_EMISSIVE_IDLE) * t;
				const length = ENGINE_PLUME_LENGTH_IDLE + (ENGINE_PLUME_LENGTH_MAX - ENGINE_PLUME_LENGTH_IDLE) * t;
				const opacity = ENGINE_PLUME_OPACITY_IDLE + (ENGINE_PLUME_OPACITY_MAX - ENGINE_PLUME_OPACITY_IDLE) * t;
				for (const mount of engineGlow.mounts) {
					const width = mount.size * ENGINE_PLUME_WIDTH_MULT;
					mount.plume.scale.set(width, width, mount.size * length);
					mount.plumeMat.opacity = opacity;
				}
			});
	},
});
