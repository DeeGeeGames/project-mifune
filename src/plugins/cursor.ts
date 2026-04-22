import { Raycaster, Plane, Vector3, Vector2 } from 'three';
import { definePlugin } from '../types';
import { CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX, CAMERA_ZOOM_STEP, CAMERA_ZOOM_SPEED, GP_AXIS_RS_Y, STICK_ACTIVE_THRESHOLD } from '../constants';
import { clamp } from '../math';

export const createCursorPlugin = () => definePlugin({
	id: 'cursor',
	install: (world) => {
		world.addResource('cursorState', { x: 0, z: 0, valid: false });

		const raycaster = new Raycaster();
		const ndc = new Vector2();
		const hit = new Vector3();
		const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

		let wheelCleanup: (() => void) | null = null;

		world.addSystem('cursor-init')
			.setOnInitialize((ecs) => {
				const renderer = ecs.getResource('threeRenderer');
				const cam3d = ecs.getResource('camera3DState');
				const canvas = renderer.domElement;

				// TODO: remove this shim once createCamera3DPlugin supports wheel-to-zoom
				// natively on orthographic cameras. The plugin's built-in wheel handler
				// drives camera `distance` (dolly), which has no visible effect under
				// orthographic projection. We need `setZoom` instead. This listener runs
				// alongside the plugin's own handler (both call preventDefault, both fire).
				const onWheel = (e: WheelEvent) => {
					if (cam3d.projection !== 'orthographic') return;
					const factor = e.deltaY < 0 ? CAMERA_ZOOM_STEP : 1 / CAMERA_ZOOM_STEP;
					cam3d.setZoom(clamp(cam3d.zoom * factor, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX));
				};
				canvas.addEventListener('wheel', onWheel, { passive: false });
				wheelCleanup = () => canvas.removeEventListener('wheel', onWheel);
			})
			.setOnDetach(() => {
				wheelCleanup?.();
				wheelCleanup = null;
			});

		world.addSystem('cursor-zoom')
			.setPriority(10)
			.inPhase('preUpdate')
			.withResources(['inputState', 'camera3DState'])
			.setProcess(({ resources: { inputState: input, camera3DState: cam3d }, dt }) => {
				if (cam3d.projection !== 'orthographic') return;
				const gp = input.gamepads[0]?.connected ? input.gamepads[0] : undefined;
				const keySpeed = input.actions.isActive('zoomIn') ? 1 : input.actions.isActive('zoomOut') ? -1 : 0;
				const stickRaw = gp ? gp.axis(GP_AXIS_RS_Y) : 0;
				const stickSpeed = Math.abs(stickRaw) > STICK_ACTIVE_THRESHOLD ? -stickRaw : 0;
				const speed = keySpeed !== 0 ? keySpeed : stickSpeed;
				if (speed === 0) return;
				cam3d.setZoom(clamp(cam3d.zoom * Math.pow(CAMERA_ZOOM_SPEED, speed * dt), CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX));
			});

		world.addSystem('cursor-update')
			.setPriority(10)
			.inPhase('preUpdate')
			.withResources(['threeRenderer', 'camera', 'inputState', 'cursorState'])
			.setProcess(({ resources: { threeRenderer, camera, inputState, cursorState } }) => {
				const canvas = threeRenderer.domElement;
				const width = canvas.clientWidth || canvas.width;
				const height = canvas.clientHeight || canvas.height;
				if (width === 0 || height === 0) return;

				const rect = canvas.getBoundingClientRect();
				const localX = inputState.pointer.position.x - rect.left;
				const localY = inputState.pointer.position.y - rect.top;

				ndc.x = (localX / width) * 2 - 1;
				ndc.y = -(localY / height) * 2 + 1;

				raycaster.setFromCamera(ndc, camera);
				const intersection = raycaster.ray.intersectPlane(groundPlane, hit);
				if (!intersection) {
					cursorState.valid = false;
					return;
				}
				cursorState.x = hit.x;
				cursorState.z = hit.z;
				cursorState.valid = true;
			});
	},
});
