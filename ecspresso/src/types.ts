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
import type { ScreenEvents } from 'ecspresso';
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
import type { ShipClass, CarrierLoadout } from './ships';
import type { Group, Mesh, MeshBasicMaterial, Sprite } from 'three';
import type { KinematicState } from './kinematic';
import type { EnemyBehavior } from './enemies';
import type { BurstFireState } from './weapons';
import type { ShopOffer } from './shop';
import { waveDuration, waveSpawnInterval } from './waveMath';

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
	| 'menuRight'
	| 'menuConfirm';

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
	menuConfirm:   { keys: ['Enter', ' '], gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_A) },
};

export interface ShipComponent {
	class: ShipClass;
	hp: number;
}

export type Faction = 'ally' | 'enemy';

export type ProjectileKind = 'bullet' | 'cannon' | 'railgun' | 'pd';

export interface TurretComponent {
	ownerId: number;
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
}

export interface MissileTurretComponent {
	ownerShipId: number;
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
}

export type BeamTurretState = 'idle' | 'firing' | 'cooldown';

export interface BeamTurretComponent {
	ownerId: number;
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

export interface FormationSlotComponent {
	flagshipId: number;
	slotIndex: number;
}

export interface SummonAnimComponent {
	progress: number;
	originX: number;
	originZ: number;
}

export interface BlastComponent {
	life: number;
	maxLife: number;
	material: MeshBasicMaterial;
}

export interface PlayerState {
	resources: number;
	ownedShipIds: number[];
	commandVesselId: number;
	selectedSummon: ShipClass;
	pendingHeading: number;
	headingPreviewActive: boolean;
}

export type PlayingScreenConfig = {
	waveNumber: number;
};

export type PlayingScreenState = {
	waveNumber: number;
	phaseTimer: number;
	spawnTimer: number;
	spawnIntervalMs: number;
	kills: number;
	resourcesCollected: number;
};

export type WaveSummaryConfig = {
	waveNumber: number;
	kills: number;
	resourcesCollected: number;
};

export type WaveSummaryScreenState = WaveSummaryConfig & {
	selectedIndex: number;
};

export type TitleScreenState = {
	selectedIndex: number;
};

export type LoadoutScreenState = {
	selectedIndex: number;
};

export type MarketScreenConfig = {
	waveNumber: number;
};

export type MarketMode =
	| { kind: 'browse' }
	| { kind: 'assignPylon'; offerIdx: number };

export type MarketScreenState = {
	waveNumber: number;
	offers: ShopOffer[];
	rerollCount: number;
	mode: MarketMode;
	selectedIndex: number;
};

export type AppScreenName = 'title' | 'loadoutSelect' | 'playing' | 'waveSummary' | 'market';

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
	waveEl: HTMLElement;
	gameHudEls: readonly HTMLElement[];
	summaryEl: HTMLElement;
	summaryTitleEl: HTMLElement;
	summaryStatsEl: HTMLElement;
	summaryMenuEl: HTMLElement;
	titleEl: HTMLElement;
	titleMenuEl: HTMLElement;
	loadoutEl: HTMLElement;
	loadoutMenuEl: HTMLElement;
	marketEl: HTMLElement;
	marketTitleEl: HTMLElement;
	marketMenuEl: HTMLElement;
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
			near: -500,
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
			kinematic: KinematicState;
			burstFire: BurstFireState;
			commandVessel: true;
			formationSlot: FormationSlotComponent;
			turret: TurretComponent;
			missileTurret: MissileTurretComponent;
			beamTurret: BeamTurretComponent;
			projectile: ProjectileComponent;
			missile: MissileComponent;
			enemy: EnemyComponent;
			healthBar: HealthBarComponent;
			pickup: PickupComponent;
			summonAnim: SummonAnimComponent;
			blast: BlastComponent;
		}
	>()
	.withEventTypes<
		Renderer3DEventTypes &
		BehaviorTreeEventTypes &
		ScreenEvents<AppScreenName> &
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
			cursorState: CursorState;
			hudRefs: HudRefs;
			threatMap: ThreatMap;
			carrierLoadout: CarrierLoadout;
		}
	>()
	.withScreens(screens => screens
		.add('title', {
			initialState: (): TitleScreenState => ({
				selectedIndex: 0,
			}),
		})
		.add('loadoutSelect', {
			initialState: (): LoadoutScreenState => ({
				selectedIndex: 0,
			}),
		})
		.add('playing', {
			initialState: (config: PlayingScreenConfig): PlayingScreenState => ({
				waveNumber: config.waveNumber,
				phaseTimer: waveDuration(config.waveNumber),
				spawnTimer: 0,
				spawnIntervalMs: waveSpawnInterval(config.waveNumber),
				kills: 0,
				resourcesCollected: 0,
			}),
		})
		.add('waveSummary', {
			initialState: (config: WaveSummaryConfig): WaveSummaryScreenState => ({
				...config,
				selectedIndex: 0,
			}),
		})
		.add('market', {
			initialState: (config: MarketScreenConfig): MarketScreenState => ({
				waveNumber: config.waveNumber,
				offers: [],
				rerollCount: 0,
				mode: { kind: 'browse' },
				selectedIndex: 0,
			}),
		}),
	);

export const definePlugin = builder.pluginFactory();

export type World = ReturnType<typeof builder.build>;
