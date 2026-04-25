import { definePlugin, type World, type ProjectileKind } from '../types';
import { createMeshComponents } from 'ecspresso/plugins/rendering/renderer3D';
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

export type FxKind = ProjectileKind | 'missile';

export const spawnMuzzleFlash = (
	ecs: World,
	x: number,
	z: number,
	angle: number,
	kind: FxKind,
): void => {
	const { mesh, material } = createMuzzleFlashMesh(MUZZLE_TINT[kind]);
	ecs.spawn({
		...createMeshComponents(
			mesh,
			{ x, y: 0.6, z },
			{ rotation: { y: angle }, scale: 1 },
		),
		vfx: {
			life: MUZZLE_FLASH_LIFE_SEC,
			maxLife: MUZZLE_FLASH_LIFE_SEC,
			material,
			scaleStart: 1,
			scaleEnd: 1.6,
			opacityStart: 0.95,
		},
	}, { scope: 'playing' });
};

export const spawnImpactSpark = (
	ecs: World,
	x: number,
	z: number,
	kind: FxKind,
): void => {
	const { mesh, material } = createImpactSparkMesh(IMPACT_TINT[kind]);
	ecs.spawn({
		...createMeshComponents(mesh, { x, y: 0.6, z }, { scale: 0.6 }),
		vfx: {
			life: IMPACT_SPARK_LIFE_SEC,
			maxLife: IMPACT_SPARK_LIFE_SEC,
			material,
			scaleStart: 0.6,
			scaleEnd: 1.8,
			opacityStart: 0.9,
		},
	}, { scope: 'playing' });
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
	const outerStart = radius * 0.8;
	const outerEnd = radius * scaleMult;
	ecs.spawn({
		...createMeshComponents(outer.mesh, { x, y: 0.5, z }, { scale: outerStart }),
		vfx: {
			life,
			maxLife: life,
			material: outer.material,
			scaleStart: outerStart,
			scaleEnd: outerEnd,
			opacityStart: 0.8,
		},
	}, { scope: 'playing' });

	const coreLife = life * DEATH_EXPLOSION_CORE_LIFE_RATIO;
	const core = createExplosionMesh(DEATH_EXPLOSION_CORE_COLOR, 1.0);
	const coreStart = radius * 0.45;
	const coreEnd = radius * 1.4;
	ecs.spawn({
		...createMeshComponents(core.mesh, { x, y: 0.5, z }, { scale: coreStart }),
		vfx: {
			life: coreLife,
			maxLife: coreLife,
			material: core.material,
			scaleStart: coreStart,
			scaleEnd: coreEnd,
			opacityStart: 1.0,
		},
	}, { scope: 'playing' });
};

export const createVfxPlugin = () => definePlugin({
	id: 'vfx',
	install: (world) => {
		world.addSystem('vfx-update')
			.setPriority(400)
			.inPhase('update')
			.inScreens(['playing'])
			.setProcessEach({
				with: ['vfx', 'localTransform3D'],
				mutates: ['vfx', 'localTransform3D'],
			}, ({ entity: { id, components: { vfx, localTransform3D } }, dt, ecs }) => {
				vfx.life -= dt;
				if (vfx.life <= 0) {
					vfx.material.dispose();
					ecs.removeEntity(id);
					return;
				}
				const t = 1 - vfx.life / vfx.maxLife;
				const eased = 1 - (1 - t) * (1 - t);
				const scale = vfx.scaleStart + (vfx.scaleEnd - vfx.scaleStart) * eased;
				localTransform3D.sx = scale;
				localTransform3D.sy = scale;
				localTransform3D.sz = scale;
				vfx.material.opacity = vfx.opacityStart * (1 - t);
			});

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
