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
import { TAU, forwardXZ, wrapTau } from '../math';
import {
	AIM_ARC_COLOR,
	AIM_ARC_DASH_SIZE,
	AIM_ARC_FILL_OPACITY,
	AIM_ARC_FILL_Y_OFFSET,
	AIM_ARC_GAP_SIZE,
	AIM_ARC_RADIUS,
	AIM_ARC_SEGMENTS,
	AIM_ARC_Y_OFFSET,
	HEADING_CONFIRM_BLINK_PERIOD_SEC,
	HEADING_CONFIRM_DURATION_SEC,
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

		const arcAttr = new BufferAttribute(arcPositions, 3);
		const lineGeometry = new BufferGeometry();
		lineGeometry.setAttribute('position', arcAttr);
		const lineMaterial = new LineDashedMaterial({
			color: AIM_ARC_COLOR,
			dashSize: AIM_ARC_DASH_SIZE,
			gapSize: AIM_ARC_GAP_SIZE,
		});
		const line = new Line(lineGeometry, lineMaterial);
		line.frustumCulled = false;
		line.visible = false;

		const fillAttr = new BufferAttribute(fillPositions, 3);
		const fillGeometry = new BufferGeometry();
		fillGeometry.setAttribute('position', fillAttr);
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
			.inScreens(['playing'])
			.addSingleton('commandVessel', {
				with: ['kinematic', 'commandVessel', 'localTransform3D'],
			})
			.withResources(['playerState'])
			.setProcess(({ queries, resources: { playerState } }) => {
				const preview = playerState.headingPreviewActive;
				const confirm = playerState.confirm;
				if (!preview && !confirm) {
					line.visible = false;
					fill.visible = false;
					return;
				}

				const vessel = queries.commandVessel;
				if (!vessel) return;
				const { kinematic, localTransform3D } = vessel.components;

				const blinkOn = confirm !== null
					&& Math.floor((HEADING_CONFIRM_DURATION_SEC - confirm.timer) / (HEADING_CONFIRM_BLINK_PERIOD_SEC / 2)) % 2 === 0;
				const visible = preview || blinkOn;
				line.visible = visible;
				fill.visible = visible;

				const flip = kinematic.throttle < 0 ? Math.PI : 0;
				const src = confirm && !preview
					? { facing: confirm.facing, pending: kinematic.headingTarget, oldGoal: confirm.oldGoal }
					: { facing: kinematic.heading, pending: playerState.pendingHeading, oldGoal: kinematic.headingTarget };
				const facing = src.facing + flip;
				const pending = src.pending + flip;
				const oldGoal = src.oldGoal + flip;
				const ccwSpan = wrapTau(pending - oldGoal);
				const ccwReverseDist = wrapTau(facing + Math.PI - oldGoal);
				const useCCW = ccwReverseDist >= ccwSpan;
				const span = useCCW ? ccwSpan : ccwSpan - TAU;
				writeArcPositions(arcPositions, localTransform3D.x, localTransform3D.z, oldGoal, span, AIM_ARC_RADIUS);
				writeFillPositions(fillPositions, arcPositions, localTransform3D.x, localTransform3D.z);

				arcAttr.needsUpdate = true;
				fillAttr.needsUpdate = true;
				line.computeLineDistances();
			});
	},
});

function writeArcPositions(out: Float32Array, cx: number, cz: number, from: number, delta: number, radius: number): void {
	for (const i of ARC_INDEX_RANGE) {
		const fwd = forwardXZ(from + delta * (i / AIM_ARC_SEGMENTS));
		const o = i * 3;
		out[o] = cx + fwd.x * radius;
		out[o + 1] = AIM_ARC_Y_OFFSET;
		out[o + 2] = cz + fwd.z * radius;
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
