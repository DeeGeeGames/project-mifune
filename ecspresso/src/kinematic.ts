import { normalizeAngle, forwardXZ, clamp } from './math';

export interface KinematicState {
	heading: number;
	headingTarget: number;
	throttle: number;
	vx: number;
	vz: number;
	turnRate: number;
	turnSpeed: number;
	turnAccel: number;
	accel: number;
	maxSpeed: number;
	drag: number;
}

export interface KinematicTransform {
	x: number;
	z: number;
	ry: number;
}

export function integrateKinematicXZ(
	state: KinematicState,
	transform: KinematicTransform,
	dt: number,
): void {
	const diff = normalizeAngle(state.headingTarget - state.heading);
	const brakingSpeed = Math.sqrt(2 * state.turnAccel * Math.abs(diff));
	const desiredTurnSpeed = Math.sign(diff) * Math.min(state.turnRate, brakingSpeed);
	const turnDelta = desiredTurnSpeed - state.turnSpeed;
	state.turnSpeed += clamp(turnDelta, -state.turnAccel * dt, state.turnAccel * dt);
	state.heading = normalizeAngle(state.heading + state.turnSpeed * dt);

	const fwd = forwardXZ(state.heading);
	state.vx += fwd.x * state.accel * state.throttle * dt;
	state.vz += fwd.z * state.accel * state.throttle * dt;

	const damping = Math.max(0, 1 - state.drag * dt);
	state.vx *= damping;
	state.vz *= damping;

	const speed = Math.sqrt(state.vx * state.vx + state.vz * state.vz);
	const forwardSpeed = state.vx * fwd.x + state.vz * fwd.z;
	const maxAllowedSpeed = forwardSpeed >= 0 ? state.maxSpeed : state.maxSpeed * 0.5;
	if (speed > maxAllowedSpeed) {
		const s = maxAllowedSpeed / speed;
		state.vx *= s;
		state.vz *= s;
	}

	transform.x += state.vx * dt;
	transform.z += state.vz * dt;
	transform.ry = state.heading;
}

export interface PredictedKinematic {
	readonly state: KinematicState;
	readonly transform: KinematicTransform;
}

export function predictKinematic(
	state: KinematicState,
	transform: KinematicTransform,
	dt: number,
): PredictedKinematic {
	const nextState = { ...state };
	const nextTransform = { x: transform.x, z: transform.z, ry: transform.ry };
	integrateKinematicXZ(nextState, nextTransform, dt);
	return { state: nextState, transform: nextTransform };
}
