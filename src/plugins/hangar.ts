import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import {
	definePlugin,
	type FighterComponent,
	type HangarBay,
	type HangarComponent,
	type HangarInstance,
	type World,
} from '../types';
import {
	SHIP_SPECS,
	createShipGroup,
	spawnShipTurrets,
	type CarrierLoadout,
	type ShipSpec,
} from '../ships';
import { createKinematicState } from '../kinematic';
import { bearingXZ, distanceXZ, forwardXZ, leadTarget, mountToWorld, normalizeAngle, rotateY } from '../math';
import { spawnShipTrails } from './trail';
import {
	FIGHTER_LAUNCH_SEC,
	FIGHTER_LAUNCH_SPEED,
	HANGAR_CAPACITY,
	HANGAR_DOCK_CONTACT_MARGIN,
	HANGAR_ENGAGE_RADIUS,
	HANGAR_FIGHTER_MAX_HP,
	HANGAR_HEAL_PER_SEC,
	HANGAR_LAUNCH_INTERVAL_SEC,
	HANGAR_MANUFACTURE_SEC,
	HANGAR_ORBIT_BAND,
	HANGAR_ORBIT_LOOKAHEAD_SEC,
	HANGAR_ORBIT_RADIUS,
	TRAIL_COLOR_ALLY,
} from '../constants';

const ORBIT_ANGULAR_VEL = 0.6;

const buildBay = (slotIndex: number): HangarBay => ({
	slotIndex,
	status: 'docked',
	fighterId: null,
	storedHp: HANGAR_FIGHTER_MAX_HP,
	manufactureTimer: 0,
	orbitPhase: (slotIndex / Math.max(1, HANGAR_CAPACITY)) * Math.PI * 2,
});

const buildInstance = (dockX: number, dockZ: number): HangarInstance => ({
	dockPointX: dockX,
	dockPointZ: dockZ,
	craftKind: 'fighter',
	launchTimer: 0,
	command: 'docked',
	bays: Array.from({ length: HANGAR_CAPACITY }, (_, i) => buildBay(i)),
});

export const installHangarOnShip = (
	ecs: World,
	shipId: number,
	spec: ShipSpec,
	loadout: CarrierLoadout,
): void => {
	const auxMounts = spec.auxiliaryMounts ?? [];
	const instances: HangarInstance[] = [];
	loadout.auxSlots.forEach((slot, idx) => {
		if (slot.systemKind !== 'hangar') return;
		const mount = auxMounts[idx];
		if (!mount) return;
		instances.push(buildInstance(mount.x, mount.z));
	});
	if (instances.length === 0) return;
	const component: HangarComponent = { motherShipId: shipId, instances };
	ecs.addComponent(shipId, 'hangar', component);
};

const despawnFighterAndTurrets = (ecs: World, fighterId: number, turretIds: readonly number[]): void => {
	turretIds.forEach((id) => ecs.removeEntity(id));
	ecs.removeEntity(fighterId);
};

export const onFighterDestroyed = (ecs: World, fighterId: number): void => {
	const fighter = ecs.getComponent(fighterId, 'fighter');
	const turretIds = fighter?.turretIds ?? [];
	if (fighter) {
		const hangar = ecs.getComponent(fighter.motherShipId, 'hangar');
		const instance = hangar?.instances[fighter.hangarInstanceIdx];
		const bay = instance?.bays[fighter.slotIndex];
		if (bay) {
			bay.status = 'manufacturing';
			bay.fighterId = null;
			bay.storedHp = 0;
			bay.manufactureTimer = HANGAR_MANUFACTURE_SEC;
		}
	}
	despawnFighterAndTurrets(ecs, fighterId, turretIds);
};

interface MotherState {
	readonly x: number;
	readonly z: number;
	readonly heading: number;
	readonly vx: number;
	readonly vz: number;
	readonly halfWidth: number;
	readonly halfLength: number;
}

const readMotherState = (ecs: World, shipId: number): MotherState | null => {
	const transform = ecs.getComponent(shipId, 'localTransform3D');
	const kinematic = ecs.getComponent(shipId, 'kinematic');
	const ship = ecs.getComponent(shipId, 'ship');
	if (!transform || !kinematic || !ship) return null;
	const spec = SHIP_SPECS[ship.class];
	return {
		x: transform.x,
		z: transform.z,
		heading: kinematic.heading,
		vx: kinematic.vx,
		vz: kinematic.vz,
		halfWidth: spec.hullWidth / 2,
		halfLength: spec.hullLength / 2,
	};
};

const fighterInMotherContact = (mother: MotherState, fx: number, fz: number): boolean => {
	const local = rotateY({ x: fx - mother.x, z: fz - mother.z }, -mother.heading);
	return Math.abs(local.x) <= mother.halfWidth + HANGAR_DOCK_CONTACT_MARGIN
		&& Math.abs(local.z) <= mother.halfLength + HANGAR_DOCK_CONTACT_MARGIN;
};

const orbitSlotWorld = (mother: MotherState, radius: number, phase: number, lookaheadSec: number) => ({
	x: mother.x + mother.vx * lookaheadSec + Math.sin(phase) * radius,
	z: mother.z + mother.vz * lookaheadSec + Math.cos(phase) * radius,
});

const bayLaunchHeading = (mother: MotherState, localX: number): number => {
	if (localX > 0) return normalizeAngle(mother.heading + Math.PI / 2);
	if (localX < 0) return normalizeAngle(mother.heading - Math.PI / 2);
	return mother.heading;
};

const spawnFighter = (
	ecs: World,
	motherShipId: number,
	hangarInstanceIdx: number,
	bay: HangarBay,
	spawnX: number,
	spawnZ: number,
	launchHeading: number,
): number => {
	const spec = SHIP_SPECS.fighter;
	const built = createShipGroup('fighter');
	const kinematic = createKinematicState(spec, launchHeading);
	const fwd = forwardXZ(launchHeading);
	kinematic.vx = fwd.x * FIGHTER_LAUNCH_SPEED;
	kinematic.vz = fwd.z * FIGHTER_LAUNCH_SPEED;
	kinematic.throttle = 1;
	kinematic.maxSpeed = FIGHTER_LAUNCH_SPEED;
	const fighterComponent: FighterComponent = {
		motherShipId,
		hangarInstanceIdx,
		slotIndex: bay.slotIndex,
		mode: 'launching',
		engageTargetId: null,
		orbitPhase: bay.orbitPhase,
		launchTimer: FIGHTER_LAUNCH_SEC,
		launchHeading,
		turretIds: [],
	};
	const entity = ecs.spawn({
		...createGroupComponents(built.group, { x: spawnX, y: 0, z: spawnZ }, { rotation: { y: launchHeading } }),
		ship: { class: 'fighter', hp: bay.storedHp },
		kinematic,
		fighter: fighterComponent,
		engineGlow: { material: built.engineMaterial, mounts: built.engineMounts },
	}, { scope: 'playing' });
	spawnShipTrails(ecs, entity.id, built.engineMounts, TRAIL_COLOR_ALLY);
	fighterComponent.turretIds = spawnShipTurrets(ecs, entity.id, spec, built);
	return entity.id;
};

const pickDeployBay = (instance: HangarInstance): HangarBay | null =>
	instance.bays.find((b) => b.status === 'docked') ?? null;

type KinematicMutable = { headingTarget: number; throttle: number };

const steerTowards = (
	kinematic: KinematicMutable,
	fromX: number,
	fromZ: number,
	toX: number,
	toZ: number,
	distance: number,
	arriveRadius: number,
): void => {
	kinematic.headingTarget = bearingXZ(fromX, fromZ, toX, toZ);
	kinematic.throttle = distance > arriveRadius ? 1 : Math.max(0.2, distance / arriveRadius);
};

interface EnemyCandidate {
	readonly id: number;
	readonly x: number;
	readonly z: number;
	readonly vx: number;
	readonly vz: number;
}

const driveFighterOrbit = (
	kinematic: KinematicMutable,
	fx: number,
	fz: number,
	mother: MotherState,
	phase: number,
): void => {
	const slot = orbitSlotWorld(mother, HANGAR_ORBIT_RADIUS, phase, HANGAR_ORBIT_LOOKAHEAD_SEC);
	const d = distanceXZ(fx, fz, slot.x, slot.z);
	if (d < HANGAR_ORBIT_BAND) {
		const tangent = normalizeAngle(bearingXZ(mother.x, mother.z, fx, fz) + Math.PI / 2);
		kinematic.headingTarget = tangent;
		kinematic.throttle = 0.5;
		return;
	}
	steerTowards(kinematic, fx, fz, slot.x, slot.z, d, HANGAR_ORBIT_RADIUS);
};

const driveFighterEngage = (
	fighter: FighterComponent,
	kinematic: KinematicMutable & { maxSpeed: number },
	fx: number,
	fz: number,
	mother: MotherState,
	candidates: readonly EnemyCandidate[],
): void => {
	if (fighter.engageTargetId === null) {
		fighter.mode = 'orbit';
		return;
	}
	const target = candidates.find((c) => c.id === fighter.engageTargetId);
	if (!target) {
		fighter.engageTargetId = null;
		fighter.mode = 'orbit';
		return;
	}
	const dMother = distanceXZ(mother.x, mother.z, target.x, target.z);
	if (dMother > HANGAR_ENGAGE_RADIUS * 1.4) {
		fighter.engageTargetId = null;
		fighter.mode = 'orbit';
		return;
	}
	const lead = leadTarget(fx, fz, target.x, target.z, target.vx, target.vz, kinematic.maxSpeed);
	kinematic.headingTarget = bearingXZ(fx, fz, lead.x, lead.z);
	kinematic.throttle = 1;
};

const driveFighterReturning = (
	ecs: World,
	fighter: FighterComponent,
	fighterId: number,
	kinematic: KinematicMutable,
	fx: number,
	fz: number,
	mother: MotherState,
	instance: HangarInstance,
): void => {
	const bay = instance.bays[fighter.slotIndex];
	if (!bay) {
		despawnFighterAndTurrets(ecs, fighterId, fighter.turretIds);
		return;
	}
	if (fighterInMotherContact(mother, fx, fz)) {
		const ship = ecs.getComponent(fighterId, 'ship');
		bay.storedHp = Math.max(0, ship?.hp ?? bay.storedHp);
		bay.status = 'docked';
		bay.fighterId = null;
		despawnFighterAndTurrets(ecs, fighterId, fighter.turretIds);
		return;
	}
	const dock = mountToWorld(mother.x, mother.z, mother.heading, instance.dockPointX, instance.dockPointZ);
	const d = distanceXZ(fx, fz, dock.x, dock.z);
	steerTowards(kinematic, fx, fz, dock.x, dock.z, d, 2);
};

const findNearestEnemy = (
	candidates: readonly EnemyCandidate[],
	centerX: number,
	centerZ: number,
	radius: number,
): EnemyCandidate | null =>
	candidates.reduce<{ c: EnemyCandidate; d: number } | null>((best, c) => {
		const d = distanceXZ(centerX, centerZ, c.x, c.z);
		if (d > radius) return best;
		if (best && d >= best.d) return best;
		return { c, d };
	}, null)?.c ?? null;

export const createHangarPlugin = () => definePlugin({
	id: 'hangar',
	install: (world) => {
		world.addSystem('hangar-toggle')
			.setPriority(55)
			.inPhase('preUpdate')
			.inScreens(['playing'])
			.withResources(['inputState', 'playerState'])
			.setProcess(({ resources: { inputState, playerState }, ecs }) => {
				if (!inputState.actions.justActivated('toggleHangar')) return;
				const hangar = ecs.getComponent(playerState.commandVesselId, 'hangar');
				if (!hangar) return;
				hangar.instances.forEach((instance) => {
					instance.command = instance.command === 'deployed' ? 'docked' : 'deployed';
					instance.launchTimer = 0;
				});
			});

		world.addSystem('hangar-bay-update')
			.setPriority(195)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('hangars', { with: ['hangar'] })
			.setProcess(({ queries, dt, ecs }) => {
				for (const { id: shipId, components: { hangar } } of queries.hangars) {
					const mother = readMotherState(ecs, shipId);
					if (!mother) continue;
					hangar.instances.forEach((instance, instanceIdx) => {
						instance.bays.forEach((bay) => {
							bay.orbitPhase = normalizeAngle(bay.orbitPhase + ORBIT_ANGULAR_VEL * dt);
							if (bay.status === 'docked' && bay.storedHp < HANGAR_FIGHTER_MAX_HP) {
								bay.storedHp = Math.min(HANGAR_FIGHTER_MAX_HP, bay.storedHp + HANGAR_HEAL_PER_SEC * dt);
							}
							if (bay.status === 'manufacturing') {
								bay.manufactureTimer -= dt;
								if (bay.manufactureTimer <= 0) {
									bay.status = 'docked';
									bay.manufactureTimer = 0;
									bay.storedHp = HANGAR_FIGHTER_MAX_HP;
								}
							}
						});

						if (instance.command === 'deployed') {
							instance.launchTimer -= dt;
							if (instance.launchTimer <= 0) {
								const ready = pickDeployBay(instance);
								if (ready) {
									const dock = mountToWorld(mother.x, mother.z, mother.heading, instance.dockPointX, instance.dockPointZ);
									const launchHeading = bayLaunchHeading(mother, instance.dockPointX);
									const fighterId = spawnFighter(ecs, hangar.motherShipId, instanceIdx, ready, dock.x, dock.z, launchHeading);
									ready.status = 'deployed';
									ready.fighterId = fighterId;
									const fighter = ecs.getComponent(fighterId, 'fighter');
									if (fighter) fighter.orbitPhase = ready.orbitPhase;
									instance.launchTimer = HANGAR_LAUNCH_INTERVAL_SEC;
								}
							}
						} else {
							instance.bays.forEach((deployedBay) => {
								if (deployedBay.status !== 'deployed' || deployedBay.fighterId === null) return;
								const fighter = ecs.getComponent(deployedBay.fighterId, 'fighter');
								if (!fighter) {
									deployedBay.status = 'docked';
									deployedBay.fighterId = null;
									return;
								}
								fighter.mode = 'returning';
							});
						}
					});
				}
			});

		world.addSystem('fighter-ai')
			.setPriority(198)
			.inPhase('update')
			.inScreens(['playing'])
			.addQuery('fighters', { with: ['fighter', 'kinematic', 'localTransform3D'] })
			.addQuery('enemies', { with: ['enemy', 'kinematic', 'localTransform3D'] })
			.setProcess(({ queries, dt, ecs }) => {
				const candidates: EnemyCandidate[] = queries.enemies.map((e) => ({
					id: e.id,
					x: e.components.localTransform3D.x,
					z: e.components.localTransform3D.z,
					vx: e.components.kinematic.vx,
					vz: e.components.kinematic.vz,
				}));
				const fighterSpec = SHIP_SPECS.fighter;

				for (const { id: fighterId, components: { fighter, kinematic, localTransform3D } } of queries.fighters) {
					const hangar = ecs.getComponent(fighter.motherShipId, 'hangar');
					const mother = readMotherState(ecs, fighter.motherShipId);
					if (!hangar || !mother) continue;
					const instance = hangar.instances[fighter.hangarInstanceIdx];
					if (!instance) continue;

					const bay = instance.bays[fighter.slotIndex];
					if (bay) fighter.orbitPhase = bay.orbitPhase;

					if (fighter.mode === 'launching') {
						fighter.launchTimer -= dt;
						kinematic.headingTarget = fighter.launchHeading;
						kinematic.throttle = 1;
						if (fighter.launchTimer <= 0) fighter.mode = 'orbit';
						continue;
					}

					const currentSpeed = Math.sqrt(kinematic.vx * kinematic.vx + kinematic.vz * kinematic.vz);
					kinematic.maxSpeed = currentSpeed > fighterSpec.maxSpeed + 0.1
						? currentSpeed * 2.05
						: fighterSpec.maxSpeed;

					if (fighter.mode === 'orbit') {
						const target = findNearestEnemy(candidates, mother.x, mother.z, HANGAR_ENGAGE_RADIUS);
						if (target) {
							fighter.mode = 'engage';
							fighter.engageTargetId = target.id;
						} else {
							driveFighterOrbit(kinematic, localTransform3D.x, localTransform3D.z, mother, fighter.orbitPhase);
							continue;
						}
					}

					if (fighter.mode === 'engage') {
						driveFighterEngage(fighter, kinematic, localTransform3D.x, localTransform3D.z, mother, candidates);
						continue;
					}

					if (fighter.mode === 'returning') {
						driveFighterReturning(ecs, fighter, fighterId, kinematic, localTransform3D.x, localTransform3D.z, mother, instance);
					}
				}
			});
	},
});
