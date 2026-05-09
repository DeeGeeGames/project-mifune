import type { Group, Mesh } from 'three';
import type { Faction, ShipClass, EngineMount } from './ships';

export type ProjectileKind = 'bullet' | 'cannon' | 'railgun' | 'pd';

export interface ShipComponent {
	class: ShipClass;
	hp: number;
}

export interface TurretComponent {
	faction: Faction;
	mountX: number;
	mountZ: number;
	baseAngle: number;
	aimAngle: number;
	coneHalf: number;
	range: number;
	damage: number;
	hasTarget: boolean;
	mount: Group;
	projectileKind?: ProjectileKind;
	projectileSpeed?: number;
	projectileLife?: number;
	splashDamage?: number;
	splashRadius?: number;
	pierce?: number;
	spreadHalf?: number;
}

export interface ProjectileComponent {
	faction: Faction;
	vx: number;
	vz: number;
	life: number;
	damage: number;
	splashDamage?: number;
	splashRadius?: number;
	pierce?: number;
	hitTargets?: Set<number>;
	kind?: ProjectileKind;
}

export interface MissileTurretComponent {
	mountX: number;
	mountZ: number;
	baseAngle: number;
	fireAngle: number;
	coneHalf: number;
	range: number;
	damage: number;
	mount: Group;
}

export interface MissileComponent {
	heading: number;
	speed: number;
	life: number;
	unguidedTime: number;
	damage: number;
	targetId: number | null;
	engineMount: EngineMount;
}

export type BeamTurretState = 'idle' | 'firing' | 'cooldown';

export interface BeamTurretComponent {
	faction: Faction;
	mountX: number;
	mountZ: number;
	baseAngle: number;
	aimAngle: number;
	coneHalf: number;
	range: number;
	damagePerSecond: number;
	beamDurationMs: number;
	beamCooldownMs: number;
	state: BeamTurretState;
	stateTimerMs: number;
	targetId: number | null;
	hasTarget: boolean;
	mount: Group;
	beamMesh: Mesh;
}

export interface MainGunBeamComponent {
	faction: Faction;
	mountX: number;
	mountZ: number;
	facing: number;
	detectionRange: number;
	visualLength: number;
	beamRadius: number;
	damagePerSecond: number;
	beamDurationMs: number;
	beamCooldownMs: number;
	state: BeamTurretState;
	stateTimerMs: number;
	beamMesh: Mesh;
}

export interface CombatComponents {
	ship: ShipComponent;
	turret: TurretComponent;
	missileTurret: MissileTurretComponent;
	beamTurret: BeamTurretComponent;
	mainGunBeam: MainGunBeamComponent;
	projectile: ProjectileComponent;
	missile: MissileComponent;
}

export interface ShipDestroyedEvent {
	entityId: number;
	shipClass: ShipClass;
}

export interface CarrierDestroyedEvent {
	entityId: number;
}

export interface CombatEvents {
	'ship:destroyed': ShipDestroyedEvent;
	'carrier:destroyed': CarrierDestroyedEvent;
}
