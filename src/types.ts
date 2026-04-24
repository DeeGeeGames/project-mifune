import ECSpresso from 'ecspresso';
import { createRenderer3DPlugin } from 'ecspresso/plugins/rendering/renderer3D';
import { createCamera3DPlugin } from 'ecspresso/plugins/spatial/camera3D';
import { createInputPlugin, gamepadButtonsOn } from 'ecspresso/plugins/input/input';
import type { ActionMap } from 'ecspresso/plugins/input/input';
import { createBehaviorTreePlugin } from 'ecspresso/plugins/ai/behavior-tree';
import type { ScreenEvents } from 'ecspresso';
import {
	CAMERA_DISTANCE,
	CAMERA_VIEW_SIZE,
	CAMERA_FOLLOW_SMOOTHING,
	GP_BUTTON_A,
	GP_BUTTON_B,
	GP_BUTTON_X,
	GP_BUTTON_START,
	GP_BUTTON_BACK,
	GP_BUTTON_DPAD_UP,
	GP_BUTTON_DPAD_DOWN,
	GP_BUTTON_DPAD_LEFT,
	GP_BUTTON_DPAD_RIGHT,
	ISO_AZIMUTH,
	ISO_ELEVATION,
} from './constants';
import type { ShipClass, CarrierLoadout, EngineMount } from './ships';
import type { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Sprite } from 'three';
import type { KinematicState } from './kinematic';
import type { ColliderComponent } from './collider';
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
	| 'aimGate'
	| 'zoomIn'
	| 'zoomOut'
	| 'menuUp'
	| 'menuDown'
	| 'menuLeft'
	| 'menuRight'
	| 'menuConfirm'
	| 'menuCancel'
	| 'loadoutCycleNext'
	| 'loadoutCyclePrev'
	| 'loadoutFacing'
	| 'loadoutStart'
	| 'loadoutBack';

const actions: ActionMap<GameAction> = {
	fwd:           { keys: ['w'] },
	rev:           { keys: ['s'] },
	summon1:       { keys: ['1'] },
	summon2:       { keys: ['2'] },
	summon3:       { keys: ['3'] },
	summon4:       { keys: ['4'] },
	aimGate:       { pointerButtons: [0], gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_A) },
	zoomIn:        { keys: ['e'] },
	zoomOut:       { keys: ['q'] },
	menuUp:        { keys: ['ArrowUp'],    gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_DPAD_UP) },
	menuDown:      { keys: ['ArrowDown'],  gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_DPAD_DOWN) },
	menuLeft:      { keys: ['ArrowLeft'],  gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_DPAD_LEFT) },
	menuRight:     { keys: ['ArrowRight'], gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_DPAD_RIGHT) },
	menuConfirm:      { keys: ['Enter', ' '], gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_A) },
	menuCancel:       { keys: ['Escape'],     gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_B) },
	loadoutCycleNext: { keys: ['a'],          gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_X) },
	loadoutCyclePrev: { keys: ['d'],          gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_B) },
	loadoutFacing:    { keys: [' '],          gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_A) },
	loadoutStart:     { keys: ['Enter'],      gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_START) },
	loadoutBack:      { keys: ['Escape'],     gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_BACK) },
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
	kind?: ProjectileKind;
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
	engineMount: EngineMount;
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

export interface MainGunBeamComponent {
	ownerId: number;
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

export interface VfxComponent {
	life: number;
	maxLife: number;
	material: MeshBasicMaterial;
	scaleStart: number;
	scaleEnd: number;
	opacityStart: number;
}

export interface EngineMountRef {
	readonly plume: Mesh;
	readonly plumeMat: MeshBasicMaterial;
	readonly size: number;
}

export interface EngineGlowComponent {
	material: MeshStandardMaterial;
	mounts: readonly EngineMountRef[];
}

export interface TrailComponent {
	ownerId: number;
	anchor: Object3D;
	geometry: BufferGeometry;
	material: MeshBasicMaterial;
	positionAttr: BufferAttribute;
	halfWidth: number;
	centers: Float32Array;
	initialized: boolean;
}

export interface ShieldComponent {
	current: number;
	max: number;
	regenPerSec: number;
	depletedDelaySec: number;
	depletedTimer: number;
	mesh: Mesh;
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

export type LoadoutCategory = 'weapon' | 'auxiliary';

export type LoadoutScreenState = {
	category: LoadoutCategory;
	selectedPylonIdx: number;
	selectedAuxIdx: number;
	facingMode: boolean;
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

export type InputScheme = 'keyboard' | 'gamepad';

export interface LegendEntry {
	keyboard: string | null;
	gamepad: string | null;
	label: string;
}

export interface LegendState {
	scheme: InputScheme;
	entriesByScreen: Partial<Record<AppScreenName, readonly LegendEntry[]>>;
	extraEntries: readonly LegendEntry[];
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
	loadoutStatCardEl: HTMLElement;
	marketEl: HTMLElement;
	marketTitleEl: HTMLElement;
	marketResourcesEl: HTMLElement;
	marketGridEl: HTMLElement;
	marketFooterEl: HTMLElement;
	marketAssignEl: HTMLElement;
	marketStatCardEl: HTMLElement;
	legendEl: HTMLElement;
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
		preventDefaultKeys: ['Tab'],
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
	.withComponentTypes<{
		ship: ShipComponent;
		kinematic: KinematicState;
		collider: ColliderComponent;
		burstFire: BurstFireState;
		commandVessel: true;
		formationSlot: FormationSlotComponent;
		turret: TurretComponent;
		missileTurret: MissileTurretComponent;
		beamTurret: BeamTurretComponent;
		mainGunBeam: MainGunBeamComponent;
		projectile: ProjectileComponent;
		missile: MissileComponent;
		enemy: EnemyComponent;
		healthBar: HealthBarComponent;
		pickup: PickupComponent;
		summonAnim: SummonAnimComponent;
		blast: BlastComponent;
		shield: ShieldComponent;
		vfx: VfxComponent;
		engineGlow: EngineGlowComponent;
		trail: TrailComponent;
	}>()
	.withEventTypes<
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
	.withResourceTypes<{
		playerState: PlayerState;
		cursorState: CursorState;
		hudRefs: HudRefs;
		threatMap: ThreatMap;
		carrierLoadout: CarrierLoadout;
		legend: LegendState;
	}>()
	.withScreens(screens => screens
		.add('title', {
			initialState: (): TitleScreenState => ({
				selectedIndex: 0,
			}),
		})
		.add('loadoutSelect', {
			initialState: (): LoadoutScreenState => ({
				category: 'weapon',
				selectedPylonIdx: 0,
				selectedAuxIdx: 0,
				facingMode: false,
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
