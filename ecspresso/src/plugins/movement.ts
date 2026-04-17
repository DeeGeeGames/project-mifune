import { definePlugin } from '../types';
import { stepAngle, forwardXZ } from '../math';

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
					ship.heading = stepAngle(ship.heading, ship.headingTarget, ship.turnRate * dt);

					const fwd = forwardXZ(ship.heading);
					ship.vx += fwd.x * ship.accel * ship.throttle * dt;
					ship.vz += fwd.z * ship.accel * ship.throttle * dt;

					const damping = Math.max(0, 1 - ship.drag * dt);
					ship.vx *= damping;
					ship.vz *= damping;

					const speed = Math.sqrt(ship.vx * ship.vx + ship.vz * ship.vz);
					if (speed > ship.maxSpeed) {
						const s = ship.maxSpeed / speed;
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
