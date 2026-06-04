import ECSpresso from 'ecspresso';
import { createRenderer3DPlugin } from 'ecspresso/plugins/rendering/renderer3D';
import { createCamera3DPlugin } from 'ecspresso/plugins/spatial/camera3D';
import { createInputPlugin, gamepadButtonsOn } from 'ecspresso/plugins/input/input';
import type { ActionMap } from 'ecspresso/plugins/input/input';
import { createBehaviorTreePlugin } from 'ecspresso/plugins/ai/behavior-tree';
import { createTweenPlugin } from 'ecspresso/plugins/scripting/tween';
import { createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import type { ScreenEvents } from 'ecspresso';
import {
	CAMERA_DISTANCE,
	CAMERA_VIEW_SIZE,
	CAMERA_ZOOM_MIN,
	CAMERA_ZOOM_MAX,
	CAMERA_FOLLOW_SMOOTHING,
	GP_BUTTON_A,
	GP_BUTTON_B,
	GP_BUTTON_X,
	GP_BUTTON_Y,
	GP_BUTTON_START,
	GP_BUTTON_BACK,
	GP_BUTTON_DPAD_UP,
	GP_BUTTON_DPAD_DOWN,
	GP_BUTTON_DPAD_LEFT,
	GP_BUTTON_DPAD_RIGHT,
	ISO_AZIMUTH,
	ISO_ELEVATION,
} from './constants';
import type { CarrierLoadout } from './ships';
import type { KinematicState } from './kinematic';
import type { ColliderComponent } from './collider';
import type { BurstFireState } from './weapons';
import { waveDuration, waveSpawnInterval } from './waveMath';
import type { CombatComponents, CombatEvents } from './combat-types';
import type { EnemyComponents, EnemyResources, EnemyEvents } from './enemy-types';
import type { FleetComponents, FleetEvents, FleetTimerSlot } from './fleet-types';
import type { VfxComponents } from './vfx-types';
import type {
	AppScreenName,
	PlayingScreenConfig,
	PlayingScreenState,
	HomeBaseScreenState,
	SectorMapScreenState,
	TitleScreenState,
	LoadoutScreenState,
	MarketScreenConfig,
	MarketScreenState,
} from './screen-types';
import type { PlayerState, CursorState, HudRefs, LegendState } from './ui-types';
import type { CampaignState } from './campaign';

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
	| 'loadoutBack'
	| 'toggleHangar';

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
	toggleHangar:     { keys: ['h'],          gamepadButtons: gamepadButtonsOn(0, GP_BUTTON_Y) },
};

interface CoreComponents {
	kinematic: KinematicState;
	collider: ColliderComponent;
	burstFire: BurstFireState;
}

interface CoreResources {
	playerState: PlayerState;
	cursorState: CursorState;
	hudRefs: HudRefs;
	carrierLoadout: CarrierLoadout;
	legend: LegendState;
	campaignState: CampaignState;
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
		minZoom: CAMERA_ZOOM_MIN,
		maxZoom: CAMERA_ZOOM_MAX,
		target: { x: 0, y: 0, z: 0 },
		follow: { smoothing: CAMERA_FOLLOW_SMOOTHING },
		enableOrbit: false,
	}))
	.withPlugin(createBehaviorTreePlugin({ priority: 240 }))
	.withPlugin(createTweenPlugin({ priority: 390 }))
	.withPlugin(createTimerPlugin<FleetTimerSlot>({ priority: 100 }))
	.withComponentTypes<
		CoreComponents &
		CombatComponents &
		EnemyComponents &
		FleetComponents &
		VfxComponents
	>()
	.withEventTypes<
		ScreenEvents<AppScreenName> &
		CombatEvents &
		EnemyEvents &
		FleetEvents
	>()
	.withResourceTypes<CoreResources & EnemyResources>()
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
				missionNodeId: config.missionNodeId,
				waveNumber: config.waveNumber,
				phaseTimer: waveDuration(config.waveNumber),
				spawnTimer: 0,
				spawnIntervalMs: waveSpawnInterval(config.waveNumber),
				kills: 0,
				resourcesCollected: 0,
			}),
		})
		.add('homeBase', {
			initialState: (): HomeBaseScreenState => ({
				selectedIndex: 0,
			}),
		})
		.add('sectorMap', {
			initialState: (): SectorMapScreenState => ({
				selectedIndex: 0,
			}),
		})
		.add('market', {
			initialState: (config: MarketScreenConfig): MarketScreenState => ({
				waveNumber: config.waveNumber,
				nextWaveNumber: config.nextWaveNumber,
				...(config.lastMissionResult ? { lastMissionResult: config.lastMissionResult } : {}),
				offers: [],
				rerollCount: 0,
				mode: { kind: 'browse' },
				selectedIndex: 0,
			}),
		}),
	);

export const definePlugin = builder.pluginFactory();

export type World = ReturnType<typeof builder.build>;
