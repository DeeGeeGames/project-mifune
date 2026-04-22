import { definePlugin } from '../types';
import { clamp, forwardXZ } from '../math';
import {
	CAMERA_LEAD_ALIGN_THRESHOLD,
	CAMERA_LEAD_BASE_PER_SUM,
	CAMERA_LEAD_CHARGE_RATE,
	CAMERA_LEAD_DECAY_RATE,
	CAMERA_LEAD_MAX,
	CAMERA_LEAD_SMOOTHING,
} from '../constants';

const EPS = 1e-4;

interface LeadState {
	leadX: number;
	leadZ: number;
	charge: number;
	prevZoomScale: number;
}

const resetLeadState = (state: LeadState): void => {
	state.leadX = 0;
	state.leadZ = 0;
	state.charge = 0;
	state.prevZoomScale = 1;
};

export const createCameraLeadPlugin = () => definePlugin({
	id: 'cameraLead',
	install: (world) => {
		const state: LeadState = { leadX: 0, leadZ: 0, charge: 0, prevZoomScale: 1 };

		world.eventBus.subscribe('screenEnter', ({ screen }) => {
			if (screen === 'playing') resetLeadState(state);
		});

		world.addSystem('camera-lead')
			.setPriority(410)
			.inPhase('postUpdate')
			.inScreens(['playing'])
			.setProcess(({ ecs, dt }) => {
				const cam = ecs.getResource('camera3DState');
				if (cam.followTarget < 0) return;
				const kin = ecs.getComponent(cam.followTarget, 'kinematic');
				if (!kin) return;

				const zoom = cam.projection === 'orthographic' ? cam.zoom : 1;
				const zoomScale = zoom > EPS ? 1 / zoom : 1;

				// Zoom changed: rescale accumulated lead so the on-screen offset stays
				// invariant, and shift the camera's follow target by the same delta so the
				// smoothed target doesn't have to catch up (prevents 2-step zoom-then-pan).
				const zoomRatio = zoomScale / state.prevZoomScale;
				if (Math.abs(zoomRatio - 1) > EPS) {
					const dx = state.leadX * (zoomRatio - 1);
					const dz = state.leadZ * (zoomRatio - 1);
					state.leadX += dx;
					state.leadZ += dz;
					cam.targetX += dx;
					cam.targetZ += dz;
				}
				state.prevZoomScale = zoomScale;

				const fwd = forwardXZ(kin.heading);
				const invMax = kin.maxSpeed > EPS ? 1 / kin.maxSpeed : 0;
				const sumX = fwd.x + kin.vx * invMax;
				const sumZ = fwd.z + kin.vz * invMax;
				const sumMag = Math.sqrt(sumX * sumX + sumZ * sumZ);

				let targetX = 0;
				let targetZ = 0;
				if (sumMag > EPS) {
					const sumUX = sumX / sumMag;
					const sumUZ = sumZ / sumMag;
					const leadMag = Math.sqrt(state.leadX * state.leadX + state.leadZ * state.leadZ);
					const alignment = leadMag > EPS
						? (state.leadX * sumUX + state.leadZ * sumUZ) / leadMag
						: 1;

					const chargeDelta = alignment > CAMERA_LEAD_ALIGN_THRESHOLD
						? CAMERA_LEAD_CHARGE_RATE * dt
						: -CAMERA_LEAD_DECAY_RATE * (1 - alignment) * dt;
					state.charge = clamp(state.charge + chargeDelta, 0, 1);

					const baseMag = Math.min(sumMag, 2) * CAMERA_LEAD_BASE_PER_SUM * zoomScale;
					const maxMag = CAMERA_LEAD_MAX * zoomScale;
					const targetMag = baseMag + Math.max(0, maxMag - baseMag) * state.charge;
					targetX = sumUX * targetMag;
					targetZ = sumUZ * targetMag;
				} else {
					state.charge = clamp(state.charge - CAMERA_LEAD_DECAY_RATE * dt, 0, 1);
				}

				const k = clamp(CAMERA_LEAD_SMOOTHING * dt, 0, 1);
				state.leadX += (targetX - state.leadX) * k;
				state.leadZ += (targetZ - state.leadZ) * k;

				cam.followOffsetX = state.leadX;
				cam.followOffsetZ = state.leadZ;
			});
	},
});
