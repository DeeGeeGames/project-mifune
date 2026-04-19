import { definePlugin } from '../types';
import { angleDiff, bearingXZ, clamp, distanceXZ, forwardXZ, normalizeAngle, rotateY } from '../math';
import {
	FORMATION_CONTROL_TAU,
	FORMATION_LOOKAHEAD_SEC,
	FORMATION_SEPARATION_RADIUS,
	FORMATION_SEPARATION_STRENGTH,
	FORMATION_SLOWING_RADIUS,
} from '../constants';
import { slotLocalXZ } from '../formation';
import { predictKinematic, type PredictedKinematic } from '../kinematic';

const EPS = 1e-4;

export const createFormationPlugin = () => definePlugin({
	id: 'formation',
	install: (world) => {
		world.addSystem('formation')
			.setPriority(60)
			.inPhase('preUpdate')
			.addQuery('followers', {
				with: ['ship', 'kinematic', 'formationSlot', 'localTransform3D'],
				without: ['summonAnim', 'commandVessel'],
			})
			.setProcess(({ queries, ecs }) => {
				const predictions = new Map<number, PredictedKinematic | null>();
				const predictFor = (flagshipId: number): PredictedKinematic | null => {
					const cached = predictions.get(flagshipId);
					if (cached !== undefined) return cached;
					const flagshipKinematic = ecs.getComponent(flagshipId, 'kinematic');
					const flagshipTransform = ecs.getComponent(flagshipId, 'localTransform3D');
					const predicted = flagshipKinematic && flagshipTransform
						? predictKinematic(flagshipKinematic, flagshipTransform, FORMATION_LOOKAHEAD_SEC)
						: null;
					predictions.set(flagshipId, predicted);
					return predicted;
				};

				const followerList = Array.from(queries.followers);
				const sepR2 = FORMATION_SEPARATION_RADIUS * FORMATION_SEPARATION_RADIUS;

				for (const { id, components: { kinematic, formationSlot, localTransform3D } } of followerList) {
					const predicted = predictFor(formationSlot.flagshipId);
					if (!predicted) {
						kinematic.throttle = 0;
						continue;
					}

					const slotLocal = slotLocalXZ(formationSlot.slotIndex);
					const slotWorld = rotateY(slotLocal, -predicted.state.heading);
					const targetX = predicted.transform.x + slotWorld.x;
					const targetZ = predicted.transform.z + slotWorld.z;

					// Slot velocity = flagship linear velocity + ω × r (yaw rotation contribution).
					const slotVX = predicted.state.vx + predicted.state.turnSpeed * slotWorld.z;
					const slotVZ = predicted.state.vz - predicted.state.turnSpeed * slotWorld.x;

					const dx = targetX - localTransform3D.x;
					const dz = targetZ - localTransform3D.z;
					const dist = distanceXZ(targetX, targetZ, localTransform3D.x, localTransform3D.z);

					const approachSpeed = dist < FORMATION_SLOWING_RADIUS
						? kinematic.maxSpeed * (dist / FORMATION_SLOWING_RADIUS)
						: kinematic.maxSpeed;
					const dirX = dist > EPS ? dx / dist : 0;
					const dirZ = dist > EPS ? dz / dist : 0;

					const sep = followerList.reduce((acc, other) => {
						if (other.id === id) return acc;
						const odx = localTransform3D.x - other.components.localTransform3D.x;
						const odz = localTransform3D.z - other.components.localTransform3D.z;
						const d2 = odx * odx + odz * odz;
						if (d2 >= sepR2 || d2 < EPS * EPS) return acc;
						const d = Math.sqrt(d2);
						const scale = (1 - d / FORMATION_SEPARATION_RADIUS) * FORMATION_SEPARATION_STRENGTH;
						return { x: acc.x + (odx / d) * scale, z: acc.z + (odz / d) * scale };
					}, { x: 0, z: 0 });

					// Adding slot velocity makes the follower cruise alongside a moving flagship
					// instead of overshooting — at the slot the approach term is zero.
					const desiredVX = dirX * approachSpeed + slotVX + sep.x;
					const desiredVZ = dirZ * approachSpeed + slotVZ + sep.z;
					const desiredMag = Math.sqrt(desiredVX * desiredVX + desiredVZ * desiredVZ);

					// Near slot, desiredV ≈ slot tangent — blend toward flagship bow.
					const desiredBearing = desiredMag > EPS
						? bearingXZ(0, 0, desiredVX, desiredVZ)
						: predicted.state.heading;
					const alignT = 1 - clamp(dist / FORMATION_SLOWING_RADIUS, 0, 1);
					kinematic.headingTarget = normalizeAngle(
						desiredBearing + alignT * angleDiff(predicted.state.heading, desiredBearing),
					);

					// Project desired velocity onto current heading so throttle doesn't spike
					// while turning (magnitude would stay high even when we're sideways to it).
					const fwd = forwardXZ(kinematic.heading);
					const forwardSpeed = kinematic.vx * fwd.x + kinematic.vz * fwd.z;
					const desiredForwardSpeed = desiredVX * fwd.x + desiredVZ * fwd.z;
					const dragCompensation = desiredForwardSpeed * kinematic.drag;
					const proportional = (desiredForwardSpeed - forwardSpeed) / FORMATION_CONTROL_TAU;
					kinematic.throttle = clamp((dragCompensation + proportional) / kinematic.accel, -1, 1);
				}
			});
	},
});
