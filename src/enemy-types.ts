import type { Sprite } from 'three';
import type { EnemyBehavior } from './enemies';

export interface EnemyComponent {
	hp: number;
	maxHp: number;
	radius: number;
	threatTolerance: number;
	hitEscalation: number;
	behavior: EnemyBehavior;
}

export interface HealthBarComponent {
	bg: Sprite;
	fill: Sprite;
	lastRatio: number;
}

export interface EnemyThreatSummary {
	staticDps: number;
	coneThreat: number;
	dominantTurretId: number | null;
	dominantTurretX: number;
	dominantTurretZ: number;
}

export interface ThreatMap {
	readonly byEnemyId: Map<number, EnemyThreatSummary>;
}

export interface PickupComponent {
	value: number;
	magnetized: boolean;
}

export interface EnemyComponents {
	enemy: EnemyComponent;
	healthBar: HealthBarComponent;
	pickup: PickupComponent;
}

export interface EnemyResources {
	threatMap: ThreatMap;
}

export interface EnemyKilledEvent {
	entityId: number;
	x: number;
	z: number;
}

export interface PickupCollectedEvent {
	value: number;
}

export interface EnemyEvents {
	'enemy:killed': EnemyKilledEvent;
	'pickup:collected': PickupCollectedEvent;
}
