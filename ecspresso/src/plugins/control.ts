import { definePlugin } from '../types';
import type { ShipClass } from '../ships';
import {
	GP_BUTTON_LT,
	GP_BUTTON_RT,
	GP_AXIS_LS_X,
	GP_AXIS_LS_Y,
	GP_AXIS_RS_X,
	GP_AXIS_RS_Y,
	ISO_AZIMUTH,
	STICK_ACTIVE_THRESHOLD,
	TRIGGER_DEADZONE,
	THRUST_RATE,
} from '../constants';
import { bearingXZ, stickToWorldAngle, clamp } from '../math';

const SUMMON_BY_ACTION: Record<'summon1' | 'summon2' | 'summon3' | 'summon4', ShipClass> = {
	summon1: 'corvette',
	summon2: 'frigate',
	summon3: 'destroyer',
	summon4: 'dreadnought',
};

export const createControlPlugin = () => definePlugin({
	id: 'control',
	install: (world) => {
		world.addSystem('control')
			.setPriority(50)
			.inPhase('preUpdate')
			.addQuery('commandVessel', {
				with: ['ship', 'commandVessel', 'localTransform3D'],
			})
			.withResources(['inputState', 'cursorState', 'playerState'])
			.setProcess(({ queries, resources: { inputState: input, cursorState, playerState }, ecs, dt }) => {
				const gp = input.gamepads[0];
				const hasGamepad = gp?.connected ?? false;

				const gateHeld = input.actions.isActive('aimGate');
				const gateReleased = input.actions.justDeactivated('aimGate');
				const lockPressed = input.actions.justActivated('aimGate');

				for (const { components: { ship, localTransform3D } } of queries.commandVessel) {
					const stickActive = hasGamepad && isStickActive(gp, GP_AXIS_LS_X, GP_AXIS_LS_Y);
					const shouldTrack = hasGamepad ? stickActive : gateHeld;
					const shouldCommit = hasGamepad ? lockPressed : gateReleased;

					if (shouldCommit) {
						ship.headingTarget = playerState.pendingHeading;
					}
					playerState.pendingHeading = shouldTrack
						? computePendingHeading(
							playerState.pendingHeading,
							localTransform3D.x,
							localTransform3D.z,
							cursorState,
							hasGamepad,
							gp,
						)
						: ship.headingTarget;
					playerState.headingPreviewActive = shouldTrack;
					ship.throttle = updateThrust(ship.throttle, input, gp, hasGamepad, dt);
				}

				const overrideHeld = input.actions.isActive('overrideAim');
				playerState.controlMode = overrideHeld ? 'override' : 'autonomous';

				if (overrideHeld) {
					playerState.overrideAimAngle = computeOverrideAim(
						queries.commandVessel[0]?.components.localTransform3D,
						cursorState,
						gp,
						hasGamepad,
						playerState.overrideAimAngle,
					);
				}

				if (input.actions.justActivated('cycleVessel')) {
					ecs.eventBus.publish('vessel:cycleRequested', undefined);
				}

				for (const [action, shipClass] of Object.entries(SUMMON_BY_ACTION)) {
					if (input.actions.justActivated(action as 'summon1' | 'summon2' | 'summon3' | 'summon4')) {
						ecs.eventBus.publish('summon:request', { shipClass });
					}
				}

				if (input.actions.justActivated('confirmSummon')) {
					ecs.eventBus.publish('summon:request', { shipClass: playerState.selectedSummon });
				}

				if (input.actions.justActivated('menuLeft')) {
					playerState.selectedSummon = stepSummon(playerState.selectedSummon, -1);
				}
				if (input.actions.justActivated('menuRight')) {
					playerState.selectedSummon = stepSummon(playerState.selectedSummon, 1);
				}
			});
	},
});

const SUMMON_ORDER: readonly ShipClass[] = ['corvette', 'frigate', 'destroyer', 'dreadnought'];

function stepSummon(current: ShipClass, direction: 1 | -1): ShipClass {
	const idx = SUMMON_ORDER.indexOf(current);
	const next = (idx + direction + SUMMON_ORDER.length) % SUMMON_ORDER.length;
	return SUMMON_ORDER[next] ?? 'corvette';
}

function isStickActive(
	gp: { axis(i: number): number } | undefined,
	axisX: number,
	axisY: number,
): boolean {
	if (!gp) return false;
	const x = gp.axis(axisX);
	const y = gp.axis(axisY);
	return Math.sqrt(x * x + y * y) > STICK_ACTIVE_THRESHOLD;
}

function computePendingHeading(
	current: number,
	shipX: number,
	shipZ: number,
	cursor: { x: number; z: number; valid: boolean },
	hasGamepad: boolean,
	gp: { axis(i: number): number; connected: boolean } | undefined,
): number {
	if (hasGamepad && gp) {
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
	gp: { buttonValue(b: number): number; connected: boolean } | undefined,
	hasGamepad: boolean,
	dt: number,
): number {
	if (hasGamepad && gp) {
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

function computeOverrideAim(
	flagshipTransform: { x: number; z: number } | undefined,
	cursor: { x: number; z: number; valid: boolean },
	gp: { axis(i: number): number; connected: boolean } | undefined,
	hasGamepad: boolean,
	previousAngle: number,
): number {
	if (hasGamepad && gp) {
		const angle = stickToWorldAngle(gp.axis(GP_AXIS_RS_X), gp.axis(GP_AXIS_RS_Y), STICK_ACTIVE_THRESHOLD, ISO_AZIMUTH);
		if (angle !== null) return angle;
	}
	if (flagshipTransform && cursor.valid) {
		return bearingXZ(flagshipTransform.x, flagshipTransform.z, cursor.x, cursor.z);
	}
	return previousAngle;
}
