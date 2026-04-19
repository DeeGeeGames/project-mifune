import {
	BufferAttribute,
	BufferGeometry,
	DoubleSide,
	Line,
	LineDashedMaterial,
	Mesh,
	MeshBasicMaterial,
} from 'three';
import { definePlugin } from '../types';
import { angleDiff, forwardXZ } from '../math';
import {
	AIM_ARC_COLOR,
	AIM_ARC_DASH_SIZE,
	AIM_ARC_FILL_OPACITY,
	AIM_ARC_FILL_Y_OFFSET,
	AIM_ARC_GAP_SIZE,
	AIM_ARC_RADIUS,
	AIM_ARC_SEGMENTS,
	AIM_ARC_Y_OFFSET,
} from '../constants';

const ARC_VERTS = AIM_ARC_SEGMENTS + 1;
const FILL_VERTS = AIM_ARC_SEGMENTS + 2;
const ARC_INDEX_RANGE = Array.from({ length: ARC_VERTS }, (_, i) => i);
const FILL_INDICES = Array.from(
	{ length: AIM_ARC_SEGMENTS },
	(_, i) => [0, i + 1, i + 2],
).flat();

export const createAimPreviewPlugin = () => definePlugin({
	id: 'aimPreview',
	install: (world) => {
		const arcPositions = new Float32Array(ARC_VERTS * 3);
		const fillPositions = new Float32Array(FILL_VERTS * 3);

		const lineGeometry = new BufferGeometry();
		lineGeometry.setAttribute('position', new BufferAttribute(arcPositions, 3));
		const lineMaterial = new LineDashedMaterial({
			color: AIM_ARC_COLOR,
			dashSize: AIM_ARC_DASH_SIZE,
			gapSize: AIM_ARC_GAP_SIZE,
		});
		const line = new Line(lineGeometry, lineMaterial);
		line.frustumCulled = false;
		line.visible = false;

		const fillGeometry = new BufferGeometry();
		fillGeometry.setAttribute('position', new BufferAttribute(fillPositions, 3));
		fillGeometry.setIndex(FILL_INDICES);
		const fillMaterial = new MeshBasicMaterial({
			color: AIM_ARC_COLOR,
			transparent: true,
			opacity: AIM_ARC_FILL_OPACITY,
			side: DoubleSide,
			depthWrite: false,
		});
		const fill = new Mesh(fillGeometry, fillMaterial);
		fill.frustumCulled = false;
		fill.visible = false;

		world.addSystem('aimPreview-init')
			.setOnInitialize((ecs) => {
				const scene = ecs.getResource('scene');
				scene.add(line);
				scene.add(fill);
			})
			.setOnDetach(() => {
				line.removeFromParent();
				fill.removeFromParent();
				lineGeometry.dispose();
				fillGeometry.dispose();
				lineMaterial.dispose();
				fillMaterial.dispose();
			});

		world.addSystem('aimPreview')
			.inPhase('render')
			.addQuery('commandVessel', {
				with: ['kinematic', 'commandVessel', 'localTransform3D'],
			})
			.withResources(['playerState'])
			.setProcess(({ queries, resources: { playerState } }) => {
				const preview = playerState.headingPreviewActive;
				line.visible = preview;
				fill.visible = preview;
				if (!preview) return;

				const vessel = queries.commandVessel[0];
				if (!vessel) return;
				const { kinematic, localTransform3D } = vessel.components;

				writeArcPositions(arcPositions, localTransform3D.x, localTransform3D.z, kinematic.heading, playerState.pendingHeading);
				writeFillPositions(fillPositions, arcPositions, localTransform3D.x, localTransform3D.z);

				lineGeometry.getAttribute('position').needsUpdate = true;
				fillGeometry.getAttribute('position').needsUpdate = true;
				line.computeLineDistances();
			});
	},
});

function writeArcPositions(out: Float32Array, cx: number, cz: number, from: number, to: number): void {
	const delta = angleDiff(to, from);
	for (const i of ARC_INDEX_RANGE) {
		const fwd = forwardXZ(from + delta * (i / AIM_ARC_SEGMENTS));
		const o = i * 3;
		out[o] = cx + fwd.x * AIM_ARC_RADIUS;
		out[o + 1] = AIM_ARC_Y_OFFSET;
		out[o + 2] = cz + fwd.z * AIM_ARC_RADIUS;
	}
}

function writeFillPositions(out: Float32Array, arc: Float32Array, cx: number, cz: number): void {
	out[0] = cx;
	out[1] = AIM_ARC_FILL_Y_OFFSET;
	out[2] = cz;
	for (const i of ARC_INDEX_RANGE) {
		const src = i * 3;
		const dst = (i + 1) * 3;
		out[dst] = arc[src];
		out[dst + 1] = AIM_ARC_FILL_Y_OFFSET;
		out[dst + 2] = arc[src + 2];
	}
}
