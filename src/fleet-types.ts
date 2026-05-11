import type { Mesh, MeshBasicMaterial } from 'three';
import type { ShipClass } from './ships';

export interface FormationSlotComponent {
	flagshipId: number;
	slotIndex: number;
}

export interface SummonAnimComponent {
	progress: number;
	originX: number;
	originZ: number;
}

export interface ShieldComponent {
	current: number;
	max: number;
	regenPerSec: number;
	mesh: Mesh;
	material: MeshBasicMaterial;
}

export type HangarCommand = 'docked' | 'deployed';

export type HangarBayStatus = 'docked' | 'deployed' | 'manufacturing';

export interface HangarBay {
	slotIndex: number;
	status: HangarBayStatus;
	fighterId: number | null;
	storedHp: number;
	manufactureTimer: number;
	orbitPhase: number;
}

export interface HangarInstance {
	dockPointX: number;
	dockPointZ: number;
	craftKind: 'fighter';
	launchTimer: number;
	command: HangarCommand;
	bays: HangarBay[];
}

export interface HangarComponent {
	motherShipId: number;
	instances: HangarInstance[];
}

export type FighterMode = 'launching' | 'orbit' | 'engage' | 'returning';

export interface FighterComponent {
	motherShipId: number;
	hangarInstanceIdx: number;
	slotIndex: number;
	mode: FighterMode;
	engageTargetId: number | null;
	orbitPhase: number;
	launchHeading: number;
	turretIds: readonly number[];
}

export type FleetTimerSlot = 'launch' | 'shieldDepletion';

export interface FleetComponents {
	commandVessel: true;
	formationSlot: FormationSlotComponent;
	summonAnim: SummonAnimComponent;
	shield: ShieldComponent;
	hangar: HangarComponent;
	fighter: FighterComponent;
}

export interface ShipSummonedEvent {
	entityId: number;
	shipClass: ShipClass;
}

export interface SummonRequestEvent {
	shipClass: ShipClass;
}

export interface FleetEvents {
	'ship:summoned': ShipSummonedEvent;
	'summon:request': SummonRequestEvent;
}
