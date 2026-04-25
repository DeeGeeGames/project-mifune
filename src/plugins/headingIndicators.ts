import {
	BufferAttribute,
	BufferGeometry,
	DoubleSide,
	Mesh,
	MeshBasicMaterial,
} from 'three';
import { definePlugin } from '../types';
import { bearingXZ, forwardXZ } from '../math';
import {
	AIM_ARC_RADIUS,
	HEADING_ARROW_HEAD_LENGTH,
	HEADING_ARROW_HEAD_WIDTH,
	HEADING_ARROW_OPACITY,
	HEADING_ARROW_SHAFT_WIDTH,
	HEADING_ARROW_Y_OFFSET,
	VELOCITY_ARROW_COLOR,
	VELOCITY_ARROW_MIN_SPEED,
} from '../constants';

const ARROW_VERTS = 7;
const ARROW_INDICES = [
	0, 1, 3,
	0, 3, 2,
	4, 5, 6,
];

interface Arrow {
	readonly mesh: Mesh;
	readonly positions: Float32Array;
	readonly attr: BufferAttribute;
	readonly material: MeshBasicMaterial;
}

const makeArrow = (color: number): Arrow => {
	const positions = new Float32Array(ARROW_VERTS * 3);
	const attr = new BufferAttribute(positions, 3);
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', attr);
	geometry.setIndex(ARROW_INDICES);
	const material = new MeshBasicMaterial({
		color,
		transparent: true,
		opacity: HEADING_ARROW_OPACITY,
		side: DoubleSide,
		depthWrite: false,
	});
	const mesh = new Mesh(geometry, material);
	mesh.frustumCulled = false;
	mesh.visible = false;
	return { mesh, positions, attr, material };
};

const writeArrowPositions = (
	out: Float32Array,
	cx: number,
	cz: number,
	angle: number,
	length: number,
): void => {
	const fwd = forwardXZ(angle);
	const perpX = -fwd.z;
	const perpZ = fwd.x;
	const halfShaft = HEADING_ARROW_SHAFT_WIDTH * 0.5;
	const halfHead = HEADING_ARROW_HEAD_WIDTH * 0.5;
	const shaftEnd = Math.max(0, length - HEADING_ARROW_HEAD_LENGTH);
	const neckX = cx + fwd.x * shaftEnd;
	const neckZ = cz + fwd.z * shaftEnd;
	const tipX = cx + fwd.x * length;
	const tipZ = cz + fwd.z * length;
	const y = HEADING_ARROW_Y_OFFSET;
	out[0] = cx + perpX * halfShaft;  out[1] = y; out[2] = cz + perpZ * halfShaft;
	out[3] = cx - perpX * halfShaft;  out[4] = y; out[5] = cz - perpZ * halfShaft;
	out[6] = neckX + perpX * halfShaft;  out[7] = y; out[8]  = neckZ + perpZ * halfShaft;
	out[9] = neckX - perpX * halfShaft;  out[10] = y; out[11] = neckZ - perpZ * halfShaft;
	out[12] = neckX + perpX * halfHead;  out[13] = y; out[14] = neckZ + perpZ * halfHead;
	out[15] = neckX - perpX * halfHead;  out[16] = y; out[17] = neckZ - perpZ * halfHead;
	out[18] = tipX; out[19] = y; out[20] = tipZ;
};

export const createHeadingIndicatorsPlugin = () => definePlugin({
	id: 'headingIndicators',
	install: (world) => {
		const velocity = makeArrow(VELOCITY_ARROW_COLOR);

		world.addSystem('headingIndicators-init')
			.setOnInitialize((ecs) => {
				const scene = ecs.getResource('scene');
				scene.add(velocity.mesh);
			})
			.setOnDetach(() => {
				velocity.mesh.removeFromParent();
				velocity.mesh.geometry.dispose();
				velocity.material.dispose();
			});

		world.addSystem('headingIndicators')
			.inPhase('render')
			.inScreens(['playing'])
			.addSingleton('commandVessel', {
				with: ['kinematic', 'commandVessel', 'localTransform3D'],
			})
			.withResources(['playerState'])
			.setProcess(({ queries, resources: { playerState } }) => {
				const vessel = queries.commandVessel;
				if (!vessel || !playerState.headingPreviewActive) {
					velocity.mesh.visible = false;
					return;
				}
				const { kinematic, localTransform3D } = vessel.components;
				const cx = localTransform3D.x;
				const cz = localTransform3D.z;

				const speed = Math.hypot(kinematic.vx, kinematic.vz);
				const showVelocity = speed >= VELOCITY_ARROW_MIN_SPEED;
				velocity.mesh.visible = showVelocity;
				if (showVelocity) {
					const angle = bearingXZ(0, 0, kinematic.vx, kinematic.vz);
					const effectiveMax = Math.min(kinematic.maxSpeed, kinematic.accel / kinematic.drag);
					const length = Math.min(1, speed / effectiveMax) * AIM_ARC_RADIUS;
					writeArrowPositions(velocity.positions, cx, cz, angle, length);
					velocity.attr.needsUpdate = true;
				}
			});
	},
});
