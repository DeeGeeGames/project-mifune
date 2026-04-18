import { definePlugin } from '../types';
import { bearingXZ, clamp, forwardXZ, rotateY } from '../math';
import { FORMATION_CONTROL_TAU, FORMATION_SLOWING_RADIUS } from '../constants';
import { slotLocalXZ } from '../formation';

const EPS = 1e-4;

export const createFormationPlugin = () => definePlugin({
	id: 'formation',
	install: (world) => {
		world.addSystem('formation')
			.setPriority(60)
			.inPhase('preUpdate')
			.addQuery('followers', {
				with: ['ship', 'formationSlot', 'localTransform3D'],
				without: ['summonAnim', 'commandVessel'],
			})
			.setProcess(({ queries, ecs }) => {
				for (const { components: { ship, formationSlot, localTransform3D } } of queries.followers) {
					const flagshipTransform = ecs.getComponent(formationSlot.flagshipId, 'localTransform3D');
					const flagshipShip = ecs.getComponent(formationSlot.flagshipId, 'ship');
					if (!flagshipTransform || !flagshipShip) {
						ship.throttle = 0;
						continue;
					}

					const slotLocal = slotLocalXZ(formationSlot.slotIndex);
					const slotWorld = rotateY(slotLocal, -flagshipShip.heading);
					const targetX = flagshipTransform.x + slotWorld.x;
					const targetZ = flagshipTransform.z + slotWorld.z;

					// Slot velocity = flagship linear velocity + ω × r (yaw rotation contribution).
					const slotVX = flagshipShip.vx + flagshipShip.turnSpeed * slotWorld.z;
					const slotVZ = flagshipShip.vz - flagshipShip.turnSpeed * slotWorld.x;

					const dx = targetX - localTransform3D.x;
					const dz = targetZ - localTransform3D.z;
					const dist = Math.sqrt(dx * dx + dz * dz);

					const approachSpeed = dist < FORMATION_SLOWING_RADIUS
						? ship.maxSpeed * (dist / FORMATION_SLOWING_RADIUS)
						: ship.maxSpeed;
					const dirX = dist > EPS ? dx / dist : 0;
					const dirZ = dist > EPS ? dz / dist : 0;

					// Adding slot velocity makes the follower cruise alongside a moving flagship
					// instead of overshooting — at the slot the approach term is zero.
					const desiredVX = dirX * approachSpeed + slotVX;
					const desiredVZ = dirZ * approachSpeed + slotVZ;
					const desiredMag = Math.sqrt(desiredVX * desiredVX + desiredVZ * desiredVZ);

					ship.headingTarget = desiredMag > EPS
						? bearingXZ(0, 0, desiredVX, desiredVZ)
						: flagshipShip.heading;

					// Project desired velocity onto current heading so throttle doesn't spike
					// while turning (magnitude would stay high even when we're sideways to it).
					const fwd = forwardXZ(ship.heading);
					const forwardSpeed = ship.vx * fwd.x + ship.vz * fwd.z;
					const desiredForwardSpeed = desiredVX * fwd.x + desiredVZ * fwd.z;
					const dragCompensation = desiredForwardSpeed * ship.drag;
					const proportional = (desiredForwardSpeed - forwardSpeed) / FORMATION_CONTROL_TAU;
					ship.throttle = clamp((dragCompensation + proportional) / ship.accel, -1, 1);
				}
			});
	},
});
