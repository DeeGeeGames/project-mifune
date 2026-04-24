import { definePlugin, type World } from '../types';
import { closestPointsOnSegments2D, forwardXZ } from '../math';
import {
	RESTITUTION,
	COLLISION_DAMAGE_K,
	COLLISION_POSITIONAL_SLOP,
} from '../constants';
import { applyDamageToShip } from './shield';
import { destroyShip, killEnemyAndDrop } from './combat';

const applyCollisionDamage = (ecs: World, id: number, damage: number, x: number, z: number): void => {
	const ship = ecs.getComponent(id, 'ship');
	if (ship) {
		applyDamageToShip(ecs, id, damage, ship);
		if (ship.hp <= 0) destroyShip(ecs, id, ship.class);
		return;
	}
	const enemy = ecs.getComponent(id, 'enemy');
	if (enemy) {
		enemy.hp -= damage;
		enemy.hitEscalation += damage;
		if (enemy.hp <= 0) killEnemyAndDrop(ecs, id, x, z);
	}
};

export const createCollisionPlugin = () => definePlugin({
	id: 'collision',
	install: (world) => {
		world.addSystem('collision-resolve')
			.setPriority(260)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('bodies', { with: ['collider', 'kinematic', 'localTransform3D'] })
			.setProcess(({ queries, ecs }) => {
				const items = Array.from(queries.bodies);

				for (let i = 0; i < items.length; i++) {
					const A = items[i];
					const aCol = A.components.collider;
					const aKin = A.components.kinematic;
					const aTr = A.components.localTransform3D;
					const aReach = aCol.halfLength + aCol.radius;
					const aFwd = forwardXZ(aKin.heading);
					const a1x = aTr.x - aFwd.x * aCol.halfLength;
					const a1z = aTr.z - aFwd.z * aCol.halfLength;
					const a2x = aTr.x + aFwd.x * aCol.halfLength;
					const a2z = aTr.z + aFwd.z * aCol.halfLength;

					for (let j = i + 1; j < items.length; j++) {
						const B = items[j];
						const bCol = B.components.collider;
						const bKin = B.components.kinematic;
						const bTr = B.components.localTransform3D;
						const reach = aReach + bCol.halfLength + bCol.radius;
						const dx = bTr.x - aTr.x;
						const dz = bTr.z - aTr.z;
						if (dx > reach || dx < -reach || dz > reach || dz < -reach) continue;

						const bFwd = forwardXZ(bKin.heading);
						const cp = closestPointsOnSegments2D(
							a1x, a1z, a2x, a2z,
							bTr.x - bFwd.x * bCol.halfLength, bTr.z - bFwd.z * bCol.halfLength,
							bTr.x + bFwd.x * bCol.halfLength, bTr.z + bFwd.z * bCol.halfLength,
						);
						const nxRaw = cp.bx - cp.ax;
						const nzRaw = cp.bz - cp.az;
						const distSq = nxRaw * nxRaw + nzRaw * nzRaw;
						const rSum = aCol.radius + bCol.radius;
						if (distSq > rSum * rSum) continue;

						const dist = Math.sqrt(distSq);
						const fallback = dist <= 1e-6;
						const nx = fallback ? 1 : nxRaw / dist;
						const nz = fallback ? 0 : nzRaw / dist;
						const overlap = rSum - dist;

						const contactX = (cp.ax + nx * aCol.radius + cp.bx - nx * bCol.radius) * 0.5;
						const contactZ = (cp.az + nz * aCol.radius + cp.bz - nz * bCol.radius) * 0.5;
						const rAx = contactX - aTr.x;
						const rAz = contactZ - aTr.z;
						const rBx = contactX - bTr.x;
						const rBz = contactZ - bTr.z;

						const vAx = aKin.vx - aKin.turnSpeed * rAz;
						const vAz = aKin.vz + aKin.turnSpeed * rAx;
						const vBx = bKin.vx - bKin.turnSpeed * rBz;
						const vBz = bKin.vz + bKin.turnSpeed * rBx;
						const vn = (vBx - vAx) * nx + (vBz - vAz) * nz;

						const rAxn = rAx * nz - rAz * nx;
						const rBxn = rBx * nz - rBz * nx;

						const invMassSum = aCol.invMass + bCol.invMass;
						const totalOverlap = Math.max(0, overlap - COLLISION_POSITIONAL_SLOP);
						if (totalOverlap > 0 && invMassSum > 0) {
							const shareA = aCol.invMass / invMassSum;
							const shareB = bCol.invMass / invMassSum;
							aTr.x -= nx * totalOverlap * shareA;
							aTr.z -= nz * totalOverlap * shareA;
							bTr.x += nx * totalOverlap * shareB;
							bTr.z += nz * totalOverlap * shareB;
							ecs.markChanged(A.id, 'localTransform3D');
							ecs.markChanged(B.id, 'localTransform3D');
						}

						if (vn >= 0) continue;

						const denom = invMassSum + rAxn * rAxn * aCol.invInertia + rBxn * rBxn * bCol.invInertia;
						if (denom <= 0) continue;
						const jImp = -(1 + RESTITUTION) * vn / denom;

						aKin.vx -= jImp * nx * aCol.invMass;
						aKin.vz -= jImp * nz * aCol.invMass;
						bKin.vx += jImp * nx * bCol.invMass;
						bKin.vz += jImp * nz * bCol.invMass;
						aKin.turnSpeed -= jImp * rAxn * aCol.invInertia;
						bKin.turnSpeed += jImp * rBxn * bCol.invInertia;

						const closingSpeed = -vn;
						const totalMass = aCol.mass + bCol.mass;
						if (totalMass > 0) {
							const damageA = COLLISION_DAMAGE_K * closingSpeed * (bCol.mass / totalMass) * 2;
							const damageB = COLLISION_DAMAGE_K * closingSpeed * (aCol.mass / totalMass) * 2;
							applyCollisionDamage(ecs, A.id, damageA, aTr.x, aTr.z);
							applyCollisionDamage(ecs, B.id, damageB, bTr.x, bTr.z);
						}
					}
				}
			});
	},
});
