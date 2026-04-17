import { definePlugin } from '../types';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { SHIP_SPECS, createShipGroup, type ShipClass } from '../ships';
import { SUMMON_ANIM_SEC, SUMMON_OFFSCREEN_RING, FORMATION_RADIUS } from '../constants';
import { bearingXZ, rotateY } from '../math';

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
					if (!flagshipTransform) return;

					playerState.resources -= spec.cost;

					const slotAngle = nextSlotAngle(playerState.ownedShipIds.length - 1);
					const angleFromFlagship = Math.random() * Math.PI * 2;
					const originX = flagshipTransform.x + Math.sin(angleFromFlagship) * SUMMON_OFFSCREEN_RING;
					const originZ = flagshipTransform.z + Math.cos(angleFromFlagship) * SUMMON_OFFSCREEN_RING;

					const { group, turretMounts } = createShipGroup(shipClass);

					const entity = ecs.spawn({
						...createGroupComponents(group, { x: originX, y: 0, z: originZ }, { rotation: { y: 0 } }),
						ship: {
							class: shipClass,
							heading: 0,
							headingTarget: 0,
							throttle: 0,
							vx: 0,
							vz: 0,
							turnRate: spec.turnRate,
							accel: spec.accel,
							maxSpeed: spec.maxSpeed,
							drag: spec.drag,
							hp: spec.hp,
						},
						formationSlot: { flagshipId: playerState.commandVesselId, slotAngle },
						summonAnim: { progress: 0, originX, originZ },
					});

					playerState.ownedShipIds.push(entity.id);

					spec.turrets.forEach((mountSpec, idx) => {
						const mount = turretMounts[idx];
						if (!mount) return;
						ecs.spawn({
							turret: {
								ownerShipId: entity.id,
								mountX: mountSpec.x,
								mountZ: mountSpec.z,
								baseAngle: mountSpec.baseAngle,
								aimAngle: mountSpec.baseAngle,
								lastFiredAt: 0,
								hasTarget: false,
								mount,
							},
						});
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

					const slotLocal = {
						x: Math.sin(formationSlot.slotAngle) * FORMATION_RADIUS,
						z: Math.cos(formationSlot.slotAngle) * FORMATION_RADIUS,
					};
					const slotWorld = rotateY(slotLocal, flagshipShip.heading);
					const targetX = flagshipTransform.x + slotWorld.x;
					const targetZ = flagshipTransform.z + slotWorld.z;

					const t = easeOutCubic(summonAnim.progress);
					localTransform3D.x = summonAnim.originX + (targetX - summonAnim.originX) * t;
					localTransform3D.z = summonAnim.originZ + (targetZ - summonAnim.originZ) * t;
					ship.heading = bearingXZ(localTransform3D.x, localTransform3D.z, targetX, targetZ);
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

function nextSlotAngle(existingFollowerCount: number): number {
	const total = existingFollowerCount + 1;
	return (existingFollowerCount * Math.PI * 2) / Math.max(1, total);
}

function easeOutCubic(t: number): number {
	const x = 1 - t;
	return 1 - x * x * x;
}
