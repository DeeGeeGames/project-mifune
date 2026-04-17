import { definePlugin } from '../types';
import { normalizeAngle, forwardXZ, clamp } from '../math';

export const createMovementPlugin = () => definePlugin({
	id: 'movement',
	install: (world) => {
		world.addSystem('ship-movement')
			.setPriority(200)
			.inPhase('update')
			.addQuery('ships', {
				with: ['ship', 'localTransform3D'],
				without: ['summonAnim'],
			})
			.setProcess(({ queries, dt, ecs }) => {
				for (const { id, components: { ship, localTransform3D } } of queries.ships) {
					const diff = normalizeAngle(ship.headingTarget - ship.heading);
					const brakingSpeed = Math.sqrt(2 * ship.turnAccel * Math.abs(diff));
					const desiredTurnSpeed = Math.sign(diff) * Math.min(ship.turnRate, brakingSpeed);
					const turnDelta = desiredTurnSpeed - ship.turnSpeed;
					ship.turnSpeed += clamp(turnDelta, -ship.turnAccel * dt, ship.turnAccel * dt);
					ship.heading = normalizeAngle(ship.heading + ship.turnSpeed * dt);

					const fwd = forwardXZ(ship.heading);
					ship.vx += fwd.x * ship.accel * ship.throttle * dt;
					ship.vz += fwd.z * ship.accel * ship.throttle * dt;

					const damping = Math.max(0, 1 - ship.drag * dt);
					ship.vx *= damping;
					ship.vz *= damping;

					const speed = Math.sqrt(ship.vx * ship.vx + ship.vz * ship.vz);
					const forwardSpeed = ship.vx * fwd.x + ship.vz * fwd.z;
					const maxAllowedSpeed = forwardSpeed >= 0 ? ship.maxSpeed : ship.maxSpeed * 0.5;
					if (speed > maxAllowedSpeed) {
						const s = maxAllowedSpeed / speed;
						ship.vx *= s;
						ship.vz *= s;
					}

					localTransform3D.x += ship.vx * dt;
					localTransform3D.z += ship.vz * dt;
					localTransform3D.ry = ship.heading;

					ecs.markChanged(id, 'localTransform3D');
				}
			});
	},
});
