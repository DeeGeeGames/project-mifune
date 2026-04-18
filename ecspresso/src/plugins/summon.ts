import { definePlugin } from '../types';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { SHIP_SPECS, createShipGroup, turretFromMount } from '../ships';
import { SUMMON_ANIM_SEC } from '../constants';
import { rotateY } from '../math';
import { slotLocalXZ } from '../formation';

export const createSummonPlugin = () => definePlugin({
	id: 'summon',
	install: (world) => {
		world.addSystem('summon-listener')
			.setOnInitialize((ecs) => {
				ecs.eventBus.subscribe('summon:request', ({ shipClass }) => {
					const playerState = ecs.getResource('playerState');
					const spec = SHIP_SPECS[shipClass];
					if (playerState.resources < spec.cost) return;

					const flagshipTransform = ecs.getComponent(playerState.commandVesselId, 'localTransform3D');
					const flagshipShip = ecs.getComponent(playerState.commandVesselId, 'ship');
					if (!flagshipTransform || !flagshipShip) return;

					playerState.resources -= spec.cost;

					const slotIndex = playerState.ownedShipIds.length - 1;
					const slotLocal = slotLocalXZ(slotIndex);
					const slotWorld = rotateY(slotLocal, -flagshipShip.heading);
					const originX = flagshipTransform.x + slotWorld.x;
					const originZ = flagshipTransform.z + slotWorld.z;
					const initialHeading = flagshipShip.heading;

					const { group, turretMounts } = createShipGroup(shipClass);

					const entity = ecs.spawn({
						...createGroupComponents(group, { x: originX, y: 0, z: originZ }, { rotation: { y: initialHeading } }),
						ship: {
							class: shipClass,
							heading: initialHeading,
							headingTarget: initialHeading,
							throttle: 0,
							vx: 0,
							vz: 0,
							turnRate: spec.turnRate,
							turnSpeed: 0,
							turnAccel: spec.turnAccel,
							accel: spec.accel,
							maxSpeed: spec.maxSpeed,
							drag: spec.drag,
							hp: spec.hp,
						},
						formationSlot: { flagshipId: playerState.commandVesselId, slotIndex },
						summonAnim: { progress: 0, originX, originZ },
					});

					playerState.ownedShipIds.push(entity.id);

					spec.turrets.forEach((mountSpec, idx) => {
						const mount = turretMounts[idx];
						if (!mount) return;
						ecs.spawn({ turret: turretFromMount(entity.id, mountSpec, mount) });
					});

					ecs.eventBus.publish('ship:summoned', { entityId: entity.id, shipClass });
				});
			});

		world.addSystem('summon-anim')
			.setPriority(70)
			.inPhase('update')
			.addQuery('summoning', {
				with: ['summonAnim', 'ship', 'formationSlot', 'localTransform3D'],
			})
			.setProcess(({ queries, dt, ecs }) => {
				for (const { id, components: { summonAnim, ship, formationSlot, localTransform3D } } of queries.summoning) {
					const flagshipTransform = ecs.getComponent(formationSlot.flagshipId, 'localTransform3D');
					const flagshipShip = ecs.getComponent(formationSlot.flagshipId, 'ship');
					if (!flagshipTransform || !flagshipShip) {
						ecs.removeComponent(id, 'summonAnim');
						continue;
					}

					summonAnim.progress = Math.min(1, summonAnim.progress + dt / SUMMON_ANIM_SEC);

					const slotLocal = slotLocalXZ(formationSlot.slotIndex);
					const slotWorld = rotateY(slotLocal, -flagshipShip.heading);
					const targetX = flagshipTransform.x + slotWorld.x;
					const targetZ = flagshipTransform.z + slotWorld.z;

					const t = easeOutCubic(summonAnim.progress);
					localTransform3D.x = summonAnim.originX + (targetX - summonAnim.originX) * t;
					localTransform3D.z = summonAnim.originZ + (targetZ - summonAnim.originZ) * t;
					ship.heading = flagshipShip.heading;
					ship.headingTarget = ship.heading;
					localTransform3D.ry = ship.heading;
					ecs.markChanged(id, 'localTransform3D');

					if (summonAnim.progress >= 1) {
						ecs.removeComponent(id, 'summonAnim');
					}
				}
			});
	},
});

const easeOutCubic = (t: number): number => {
	const x = 1 - t;
	return 1 - x * x * x;
};
