import { definePlugin } from '../types';
import {
	GP_BUTTON_LT,
	GP_BUTTON_RT,
	GP_AXIS_LS_X,
	GP_AXIS_LS_Y,
	ISO_AZIMUTH,
	STICK_ACTIVE_THRESHOLD,
	TRIGGER_DEADZONE,
	THRUST_RATE,
} from '../constants';
import { bearingXZ, stickToWorldAngle, clamp } from '../math';

export const createControlPlugin = () => definePlugin({
	id: 'control',
	install: (world) => {
		world.addSystem('control')
			.setPriority(50)
			.inPhase('preUpdate')
			.inScreens(['playing'])
			.addQuery('commandVessel', {
				with: ['kinematic', 'commandVessel', 'localTransform3D'],
			})
			.withResources(['inputState', 'cursorState', 'playerState', 'legend'])
			.setProcess(({ queries, resources: { inputState: input, cursorState, playerState, legend }, ecs, dt }) => {
				const rawGp = input.gamepads[0];
				const gp = (rawGp?.connected ?? false) && legend.scheme === 'gamepad' ? rawGp : undefined;

				const gateHeld = input.actions.isActive('aimGate');
				const gateReleased = input.actions.justDeactivated('aimGate');
				const lockPressed = input.actions.justActivated('aimGate');

				for (const { components: { kinematic, localTransform3D } } of queries.commandVessel) {
					const shouldTrack = gp ? isStickActive(gp, GP_AXIS_LS_X, GP_AXIS_LS_Y) : gateHeld;
					const shouldCommit = gp ? lockPressed : gateReleased;

					if (shouldCommit) {
						kinematic.headingTarget = playerState.pendingHeading;
					}
					playerState.pendingHeading = shouldTrack
						? computePendingHeading(
							playerState.pendingHeading,
							localTransform3D.x,
							localTransform3D.z,
							cursorState,
							gp,
						)
						: kinematic.headingTarget;
					playerState.headingPreviewActive = shouldTrack;
					kinematic.throttle = updateThrust(kinematic.throttle, input, gp, dt);
				}

			});
	},
});

function isStickActive(
	gp: { axis(i: number): number },
	axisX: number,
	axisY: number,
): boolean {
	const x = gp.axis(axisX);
	const y = gp.axis(axisY);
	return Math.sqrt(x * x + y * y) > STICK_ACTIVE_THRESHOLD;
}

function computePendingHeading(
	current: number,
	shipX: number,
	shipZ: number,
	cursor: { x: number; z: number; valid: boolean },
	gp: { axis(i: number): number } | undefined,
): number {
	if (gp) {
		const angle = stickToWorldAngle(gp.axis(GP_AXIS_LS_X), gp.axis(GP_AXIS_LS_Y), STICK_ACTIVE_THRESHOLD, ISO_AZIMUTH);
		return angle ?? current;
	}
	return cursor.valid ? bearingXZ(shipX, shipZ, cursor.x, cursor.z) : current;
}

function applyThrustDelta(current: number, forward: number, reverse: number, dt: number): number {
	if (forward > 0 && reverse > 0) return 0;
	return clamp(current + (forward - reverse) * THRUST_RATE * dt, -1, 1);
}

function updateThrust(
	current: number,
	input: { actions: { isActive(a: 'fwd' | 'rev'): boolean } },
	gp: { buttonValue(b: number): number } | undefined,
	dt: number,
): number {
	if (gp) {
		const rt = gp.buttonValue(GP_BUTTON_RT);
		const lt = gp.buttonValue(GP_BUTTON_LT);
		return applyThrustDelta(current, rt > TRIGGER_DEADZONE ? rt : 0, lt > TRIGGER_DEADZONE ? lt : 0, dt);
	}
	return applyThrustDelta(
		current,
		input.actions.isActive('fwd') ? 1 : 0,
		input.actions.isActive('rev') ? 1 : 0,
		dt,
	);
}

