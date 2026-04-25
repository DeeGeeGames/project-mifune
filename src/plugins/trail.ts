import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	DynamicDrawUsage,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	Vector3,
} from 'three';
import { createMeshComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { definePlugin, type World } from '../types';
import {
	TRAIL_ALPHA_HEAD,
	TRAIL_ALPHA_TAIL,
	TRAIL_EMIT_MIN_SPEED,
	TRAIL_EMIT_MIN_THROTTLE,
	TRAIL_SEGMENTS,
	TRAIL_WIDTH_ENGINE_MULT,
	TRAIL_Y,
} from '../constants';
import type { EngineMount } from '../ships';

interface RibbonBuild {
	readonly mesh: Mesh;
	readonly geometry: BufferGeometry;
	readonly material: MeshBasicMaterial;
	readonly positionAttr: BufferAttribute;
}

const buildRibbonMesh = (segments: number, color: number): RibbonBuild => {
	const geometry = new BufferGeometry();
	const positions = new Float32Array(segments * 2 * 3);
	const colors = new Float32Array(segments * 2 * 4);
	const indices: number[] = [];

	for (let i = 0; i < segments - 1; i++) {
		const a = i * 2;
		const b = i * 2 + 1;
		const c = (i + 1) * 2;
		const d = (i + 1) * 2 + 1;
		indices.push(a, b, c, c, b, d);
	}

	const r = ((color >> 16) & 0xff) / 255;
	const g = ((color >> 8) & 0xff) / 255;
	const b = (color & 0xff) / 255;
	for (let i = 0; i < segments; i++) {
		const t = segments <= 1 ? 0 : i / (segments - 1);
		const alpha = TRAIL_ALPHA_HEAD + (TRAIL_ALPHA_TAIL - TRAIL_ALPHA_HEAD) * t;
		const base = i * 2 * 4;
		colors[base + 0] = r; colors[base + 1] = g; colors[base + 2] = b; colors[base + 3] = alpha;
		colors[base + 4] = r; colors[base + 5] = g; colors[base + 6] = b; colors[base + 7] = alpha;
	}

	const positionAttr = new BufferAttribute(positions, 3);
	positionAttr.setUsage(DynamicDrawUsage);
	geometry.setAttribute('position', positionAttr);
	geometry.setAttribute('color', new BufferAttribute(colors, 4));
	geometry.setIndex(indices);

	const material = new MeshBasicMaterial({
		vertexColors: true,
		transparent: true,
		blending: AdditiveBlending,
		depthWrite: false,
	});
	const mesh = new Mesh(geometry, material);
	mesh.frustumCulled = false;

	return { mesh, geometry, material, positionAttr };
};

export const spawnShipTrails = (
	ecs: World,
	ownerId: number,
	mounts: readonly EngineMount[],
	color: number,
): void => {
	for (const mount of mounts) {
		spawnTrailForAnchor(ecs, ownerId, mount.anchor, mount.size * TRAIL_WIDTH_ENGINE_MULT, color);
	}
};

export const spawnTrailForAnchor = (
	ecs: World,
	ownerId: number,
	anchor: Object3D,
	halfWidth: number,
	color: number,
): void => {
	const build = buildRibbonMesh(TRAIL_SEGMENTS, color);
	const centers = new Float32Array(TRAIL_SEGMENTS * 3);
	ecs.spawn({
		...createMeshComponents(build.mesh, { x: 0, y: 0, z: 0 }),
		trail: {
			ownerId,
			anchor,
			geometry: build.geometry,
			material: build.material,
			positionAttr: build.positionAttr,
			halfWidth,
			centers,
			initialized: false,
		},
	}, { scope: 'playing' });
};

const _worldPos = new Vector3();

export const createTrailPlugin = () => definePlugin({
	id: 'trail',
	install: (world) => {
		world.addSystem('trail-update')
			.setPriority(395)
			.inPhase('update')
			.inScreens(['playing'])
			.setProcessEach({ with: ['trail'] }, ({ entity: { id, components: { trail } }, ecs }) => {
				const ownerTransform = ecs.getComponent(trail.ownerId, 'localTransform3D');
				if (!ownerTransform) {
					trail.geometry.dispose();
					trail.material.dispose();
					ecs.removeEntity(id);
					return;
				}

				trail.anchor.getWorldPosition(_worldPos);

				if (!trail.initialized) {
					for (let i = 0; i < TRAIL_SEGMENTS; i++) {
						trail.centers[i * 3 + 0] = _worldPos.x;
						trail.centers[i * 3 + 1] = TRAIL_Y;
						trail.centers[i * 3 + 2] = _worldPos.z;
					}
					trail.initialized = true;
				} else {
					const kinematic = ecs.getComponent(trail.ownerId, 'kinematic');
					const frozen = kinematic != null
						&& Math.abs(kinematic.throttle) < TRAIL_EMIT_MIN_THROTTLE
						&& Math.hypot(kinematic.vx, kinematic.vz) < TRAIL_EMIT_MIN_SPEED;
					if (!frozen) {
						trail.centers.copyWithin(3, 0, TRAIL_SEGMENTS * 3 - 3);
						trail.centers[0] = _worldPos.x;
						trail.centers[1] = TRAIL_Y;
						trail.centers[2] = _worldPos.z;
					}
				}

				const posArr = trail.positionAttr.array as Float32Array;
				const hw = trail.halfWidth;
				for (let i = 0; i < TRAIL_SEGMENTS; i++) {
					const cx = trail.centers[i * 3 + 0];
					const cy = trail.centers[i * 3 + 1];
					const cz = trail.centers[i * 3 + 2];

					const pi = Math.max(0, i - 1);
					const ni = Math.min(TRAIL_SEGMENTS - 1, i + 1);
					const dx = trail.centers[pi * 3 + 0] - trail.centers[ni * 3 + 0];
					const dz = trail.centers[pi * 3 + 2] - trail.centers[ni * 3 + 2];
					const len = Math.hypot(dx, dz);
					const tx = len > 1e-4 ? dx / len : 0;
					const tz = len > 1e-4 ? dz / len : 1;
					const nx = -tz;
					const nz = tx;

					const base = i * 2 * 3;
					posArr[base + 0] = cx + nx * hw;
					posArr[base + 1] = cy;
					posArr[base + 2] = cz + nz * hw;
					posArr[base + 3] = cx - nx * hw;
					posArr[base + 4] = cy;
					posArr[base + 5] = cz - nz * hw;
				}
				trail.positionAttr.needsUpdate = true;
			});
	},
});
