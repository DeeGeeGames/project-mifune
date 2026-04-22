import { definePlugin } from '../types';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { SHIP_SPECS, createShipGroup, spawnShipTurrets } from '../ships';
import { SUMMON_ANIM_SEC, SUMMON_OFFSCREEN_RING } from '../constants';
import { createKinematicState } from '../kinematic';
import { forwardXZ, rotateY } from '../math';
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
					const flagshipKinematic = ecs.getComponent(playerState.commandVesselId, 'kinematic');
					if (!flagshipTransform || !flagshipKinematic) return;

					playerState.resources -= spec.cost;

					const slotIndex = playerState.ownedShipIds.length - 1;
					const slotLocal = slotLocalXZ(slotIndex);
					const slotWorld = rotateY(slotLocal, -flagshipKinematic.heading);
					const slotX = flagshipTransform.x + slotWorld.x;
					const slotZ = flagshipTransform.z + slotWorld.z;
					const forward = forwardXZ(flagshipKinematic.heading);
					const originX = slotX - forward.x * SUMMON_OFFSCREEN_RING;
					const originZ = slotZ - forward.z * SUMMON_OFFSCREEN_RING;
					const initialHeading = flagshipKinematic.heading;

					const built = createShipGroup(shipClass);

					const entity = ecs.spawn({
						...createGroupComponents(built.group, { x: originX, y: 0, z: originZ }, { rotation: { y: initialHeading } }),
						ship: {
							class: shipClass,
							hp: spec.hp,
						},
						kinematic: createKinematicState(spec, initialHeading),
						formationSlot: { flagshipId: playerState.commandVesselId, slotIndex },
						summonAnim: { progress: 0, originX, originZ },
					});

					playerState.ownedShipIds.push(entity.id);

					spawnShipTurrets(ecs, entity.id, spec, built);

					ecs.eventBus.publish('ship:summoned', { entityId: entity.id, shipClass });
				});
			});

		world.addSystem('summon-anim')
			.setPriority(70)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('summoning', {
				with: ['summonAnim', 'kinematic', 'formationSlot', 'localTransform3D'],
			})
			.setProcess(({ queries, dt, ecs }) => {
				for (const { id, components: { summonAnim, kinematic, formationSlot, localTransform3D } } of queries.summoning) {
					const flagshipTransform = ecs.getComponent(formationSlot.flagshipId, 'localTransform3D');
					const flagshipKinematic = ecs.getComponent(formationSlot.flagshipId, 'kinematic');
					if (!flagshipTransform || !flagshipKinematic) {
						ecs.removeComponent(id, 'summonAnim');
						continue;
					}

					summonAnim.progress = Math.min(1, summonAnim.progress + dt / SUMMON_ANIM_SEC);

					const slotLocal = slotLocalXZ(formationSlot.slotIndex);
					const slotWorld = rotateY(slotLocal, -flagshipKinematic.heading);
					const targetX = flagshipTransform.x + slotWorld.x;
					const targetZ = flagshipTransform.z + slotWorld.z;

					const t = easeOutCubic(summonAnim.progress);
					localTransform3D.x = summonAnim.originX + (targetX - summonAnim.originX) * t;
					localTransform3D.z = summonAnim.originZ + (targetZ - summonAnim.originZ) * t;
					kinematic.heading = flagshipKinematic.heading;
					kinematic.headingTarget = kinematic.heading;
					localTransform3D.ry = kinematic.heading;
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
