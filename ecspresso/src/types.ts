import ECSpresso from 'ecspresso';
import { createRenderer3DPlugin } from 'ecspresso/plugins/rendering/renderer3D';
import type {
	Renderer3DComponentTypes,
	Renderer3DEventTypes,
	Renderer3DResourceTypes,
} from 'ecspresso/plugins/rendering/renderer3D';
import { createCamera3DPlugin } from 'ecspresso/plugins/spatial/camera3D';
import type { Camera3DResourceTypes } from 'ecspresso/plugins/spatial/camera3D';
import { createInputPlugin, gamepadButtonsOn } from 'ecspresso/plugins/input/input';
import type { InputResourceTypes, ActionMap } from 'ecspresso/plugins/input/input';
import { createBehaviorTreePlugin } from 'ecspresso/plugins/ai/behavior-tree';
import type {
	BehaviorTreeComponentTypes,
	BehaviorTreeEventTypes,
} from 'ecspresso/plugins/ai/behavior-tree';
import {
	CAMERA_DISTANCE,
	CAMERA_VIEW_SIZE,
	CAMERA_FOLLOW_SMOOTHING,
	GP_BUTTON_A,
	GP_BUTTON_LB,
	GP_BUTTON_DPAD_UP,
	GP_BUTTON_DPAD_DOWN,
	GP_BUTTON_DPAD_LEFT,
	GP_BUTTON_DPAD_RIGHT,
	ISO_AZIMUTH,
	ISO_ELEVATION,
} from './constants';
import type { ShipClass } from './ships';
import type { Group } from 'three';
import type { KinematicState } from './kinematic';
import type { EnemyBehavior } from './enemies';

export type GameAction =
	| 'fwd'
	| 'rev'
	| 'summon1'
	| 'summon2'
	| 'summon3'
	| 'summon4'
	| 'confirmSummon'
	| 'aimGate'
	| 'zoomIn'
	| 'zoomOut'
	| 'menuUp'
	| 'menuDown'
	| 'menuLeft'
	| 'menuRight';

const actions: ActionMap<GameAction> = {
	fwd:           { keys: ['w'] },
	rev:           { keys: ['s'] },
	summon1:       { keys: ['1'] },
	summon2:       { keys: ['2'] },
	summon3:       { keys: ['3'] },
	summon4:       { keys: ['4'] },
	confirmSummon: { gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_A) },
	aimGate:       { pointerButtons: [0], gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_LB) },
	zoomIn:        { keys: ['e'] },
	zoomOut:       { keys: ['q'] },
	menuUp:        { keys: ['ArrowUp'],    gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_DPAD_UP) },
	menuDown:      { keys: ['ArrowDown'],  gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_DPAD_DOWN) },
	menuLeft:      { keys: ['ArrowLeft'],  gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_DPAD_LEFT) },
	menuRight:     { keys: ['ArrowRight'], gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_DPAD_RIGHT) },
};

export interface ShipComponent extends KinematicState {
	class: ShipClass;
	hp: number;
}

export type Faction = 'ally' | 'enemy';

export interface TurretComponent {
	ownerId: number;
	faction: Faction;
	mountX: number;
	mountZ: number;
	baseAngle: number;
	aimAngle: number;
	coneHalf: number;
	range: number;
	fireIntervalMs: number;
	damage: number;
	lastFiredAt: number;
	hasTarget: boolean;
	mount: Group;
}

export interface ProjectileComponent {
	faction: Faction;
	vx: number;
	vz: number;
	life: number;
	damage: number;
}

export interface MissileTurretComponent {
	ownerShipId: number;
	mountX: number;
	mountZ: number;
	baseAngle: number;
	fireAngle: number;
	coneHalf: number;
	range: number;
	fireIntervalMs: number;
	damage: number;
	lastFiredAt: number;
	mount: Group;
}

export interface MissileComponent {
	heading: number;
	speed: number;
	life: number;
	unguidedTime: number;
	damage: number;
	targetId: number | null;
}

export interface EnemyComponent extends KinematicState {
	hp: number;
	radius: number;
	threatTolerance: number;
	hitEscalation: number;
	behavior: EnemyBehavior;
}

export interface EnemyThreatSummary {
	staticDps: number;
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

export interface FormationSlotComponent {
	flagshipId: number;
	slotIndex: number;
}

export interface SummonAnimComponent {
	progress: number;
	originX: number;
	originZ: number;
}

export interface PlayerState {
	resources: number;
	ownedShipIds: number[];
	commandVesselId: number;
	selectedSummon: ShipClass;
	pendingHeading: number;
	headingPreviewActive: boolean;
}

export interface WaveState {
	timer: number;
	spawnIntervalMs: number;
	elapsedSec: number;
	initialSeedDone: boolean;
}

export interface CursorState {
	x: number;
	z: number;
	valid: boolean;
}

export interface HudRefs {
	resourcesEl: HTMLElement;
	rosterEl: HTMLElement;
	menuEl: HTMLElement;
	thrustBarFillEl: HTMLElement;
}

export interface ShipSummonedEvent {
	entityId: number;
	shipClass: ShipClass;
}

export interface EnemyKilledEvent {
	entityId: number;
	x: number;
	z: number;
}

export interface PickupCollectedEvent {
	value: number;
}

export interface SummonRequestEvent {
	shipClass: ShipClass;
}

export interface ShipDestroyedEvent {
	entityId: number;
	shipClass: ShipClass;
}

export interface CarrierDestroyedEvent {
	entityId: number;
}

export const builder = ECSpresso.create()
	.withPlugin(createRenderer3DPlugin({
		container: '#game-container',
		background: 0x0b1020,
		antialias: true,
		cameraOptions: {
			projection: 'orthographic',
			viewSize: CAMERA_VIEW_SIZE,
			zoom: 1,
			near: 0.1,
			far: 500,
		},
	}))
	.withPlugin(createInputPlugin<GameAction>({
		actions,
	}))
	.withPlugin(createCamera3DPlugin({
		projection: 'orthographic',
		azimuth: ISO_AZIMUTH,
		elevation: ISO_ELEVATION,
		distance: CAMERA_DISTANCE,
		minDistance: CAMERA_DISTANCE,
		maxDistance: CAMERA_DISTANCE,
		target: { x: 0, y: 0, z: 0 },
		follow: { smoothing: CAMERA_FOLLOW_SMOOTHING },
		enableOrbit: false,
	}))
	.withPlugin(createBehaviorTreePlugin({ priority: 240 }))
	.withComponentTypes<
		Renderer3DComponentTypes &
		BehaviorTreeComponentTypes &
		{
			ship: ShipComponent;
			commandVessel: true;
			formationSlot: FormationSlotComponent;
			turret: TurretComponent;
			missileTurret: MissileTurretComponent;
			projectile: ProjectileComponent;
			missile: MissileComponent;
			enemy: EnemyComponent;
			pickup: PickupComponent;
			summonAnim: SummonAnimComponent;
		}
	>()
	.withEventTypes<
		Renderer3DEventTypes &
		BehaviorTreeEventTypes &
		{
			'ship:summoned': ShipSummonedEvent;
			'ship:destroyed': ShipDestroyedEvent;
			'carrier:destroyed': CarrierDestroyedEvent;
			'enemy:killed': EnemyKilledEvent;
			'pickup:collected': PickupCollectedEvent;
			'summon:request': SummonRequestEvent;
		}
	>()
	.withResourceTypes<
		Renderer3DResourceTypes &
		Camera3DResourceTypes &
		InputResourceTypes<GameAction> &
		{
			playerState: PlayerState;
			waveState: WaveState;
			cursorState: CursorState;
			hudRefs: HudRefs;
			threatMap: ThreatMap;
		}
	>();

export const definePlugin = builder.pluginFactory();

export type World = ReturnType<typeof builder.build>;
