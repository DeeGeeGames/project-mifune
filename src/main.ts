import { AmbientLight, BufferAttribute, BufferGeometry, DirectionalLight, Points, PointsMaterial } from 'three';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { builder, type World } from './types';
import { SHIP_SPECS, createShipGroup, spawnShipTurrets, applyCarrierLoadout, emptyLoadoutPairs, emptyLoadoutAuxSlots } from './ships';
import { createKinematicState } from './kinematic';
import { makeCollider } from './collider';
import {
	STAR_BRIGHTNESS_MIN,
	STAR_BRIGHTNESS_RANGE,
	STAR_COUNT,
	STAR_FIELD_RADIUS,
	STAR_FIELD_Y_MAX,
	STAR_FIELD_Y_MIN,
	STAR_SIZE,
	TRAIL_COLOR_ALLY,
} from './constants';
import { createCursorPlugin } from './plugins/cursor';
import { createControlPlugin } from './plugins/control';
import { createMovementPlugin } from './plugins/movement';
import { createFormationPlugin } from './plugins/formation';
import { createTurretPlugin } from './plugins/turret';
import { createMissilePlugin } from './plugins/missile';
import { createBeamPlugin } from './plugins/beam';
import { createMainGunPlugin } from './plugins/mainGun';
import { createCombatPlugin } from './plugins/combat';
import { createCollisionPlugin } from './plugins/collision';
import { createBlastPlugin } from './plugins/blast';
import { createEnemyPlugin } from './plugins/enemy';
import { createThreatPlugin } from './plugins/threat';
import { createWavesPlugin } from './plugins/waves';
import { createPickupsPlugin } from './plugins/pickups';
import { createSummonPlugin } from './plugins/summon';
import { createHudPlugin } from './plugins/hud';
import { createAimPreviewPlugin } from './plugins/aimPreview';
import { createHeadingIndicatorsPlugin } from './plugins/headingIndicators';
import { createHealthBarsPlugin } from './plugins/healthBars';
import { createWaveSummaryPlugin } from './plugins/waveSummary';
import { createTitleScreenPlugin } from './plugins/titleScreen';
import { createLoadoutSelectPlugin } from './plugins/loadoutSelect';
import { createMarketPlugin } from './plugins/market';
import { createCameraLeadPlugin } from './plugins/cameraLead';
import { buildShieldComponent, createShieldBubble, createShieldPlugin } from './plugins/shield';
import { createHangarPlugin, installHangarOnShip } from './plugins/hangar';
import { createLegendPlugin } from './plugins/legend';
import { createBackdropPlugin } from './plugins/backdrop';
import { createVfxPlugin } from './plugins/vfx';
import { createTrailPlugin, spawnShipTrails } from './plugins/trail';

const game = builder
	.withPlugin(createCursorPlugin())
	.withPlugin(createControlPlugin())
	.withPlugin(createMovementPlugin())
	.withPlugin(createCollisionPlugin())
	.withPlugin(createFormationPlugin())
	.withPlugin(createTurretPlugin())
	.withPlugin(createMissilePlugin())
	.withPlugin(createBeamPlugin())
	.withPlugin(createMainGunPlugin())
	.withPlugin(createCombatPlugin())
	.withPlugin(createBlastPlugin())
	.withPlugin(createThreatPlugin())
	.withPlugin(createEnemyPlugin())
	.withPlugin(createWavesPlugin())
	.withPlugin(createPickupsPlugin())
	// .withPlugin(createSummonPlugin()) // summoning deactivated
	.withPlugin(createHudPlugin())
	.withPlugin(createAimPreviewPlugin())
	.withPlugin(createHeadingIndicatorsPlugin())
	.withPlugin(createHealthBarsPlugin())
	.withPlugin(createWaveSummaryPlugin())
	.withPlugin(createTitleScreenPlugin())
	.withPlugin(createLoadoutSelectPlugin())
	.withPlugin(createMarketPlugin())
	.withPlugin(createCameraLeadPlugin())
	.withPlugin(createShieldPlugin())
	.withPlugin(createHangarPlugin())
	.withPlugin(createLegendPlugin())
	.withPlugin(createBackdropPlugin())
	.withPlugin(createTrailPlugin())
	.withPlugin(createVfxPlugin())
	.build();

const gameHudIds = ['hud-resources', 'hud-roster', 'hud-menu', 'hud-thrust', 'hud-wave'] as const;

game.addResource('playerState', {
	resources: 500,
	ownedShipIds: [],
	commandVesselId: -1,
	selectedSummon: 'frigate',
	pendingHeading: 0,
	headingPreviewActive: false,
});

game.addResource('carrierLoadout', {
	pylons: (SHIP_SPECS.carrier.emptyTurretMounts ?? []).map((m) => ({ weaponKind: null, facing: m.baseAngle })),
	pairs: emptyLoadoutPairs(),
	auxSlots: emptyLoadoutAuxSlots(SHIP_SPECS.carrier),
});

game.addResource('hudRefs', {
	resourcesEl: requireEl('hud-resources'),
	rosterEl: requireEl('hud-roster'),
	menuEl: requireEl('hud-menu'),
	thrustBarFillEl: requireEl('hud-thrust-fill'),
	waveEl: requireEl('hud-wave'),
	gameHudEls: gameHudIds.map(requireEl),
	summaryEl: requireEl('hud-summary'),
	summaryTitleEl: requireEl('hud-summary-title'),
	summaryStatsEl: requireEl('hud-summary-stats'),
	summaryMenuEl: requireEl('hud-summary-menu'),
	titleEl: requireEl('hud-title'),
	titleMenuEl: requireEl('hud-title-menu'),
	loadoutEl: requireEl('hud-loadout'),
	loadoutStatCardEl: requireEl('hud-loadout-stat-card'),
	marketEl: requireEl('hud-market'),
	marketTitleEl: requireEl('hud-market-title'),
	marketResourcesEl: requireEl('hud-market-resources'),
	marketGridEl: requireEl('hud-market-grid'),
	marketFooterEl: requireEl('hud-market-footer'),
	marketAssignEl: requireEl('hud-market-assign'),
	marketStatCardEl: requireEl('hud-market-stat-card'),
	legendEl: requireEl('hud-legend'),
});

game.addResource('legend', {
	scheme: 'keyboard',
	entriesByScreen: {},
	extraEntries: [],
});

game.getResource('hudRefs').gameHudEls.forEach((el) => { el.style.display = 'none'; });

await game.initialize();

const scene = game.getResource('scene');
scene.add(new AmbientLight(0xffffff, 0.55));
const sun = new DirectionalLight(0xffffff, 0.8);
sun.position.set(30, 50, 20);
scene.add(sun);

scene.add(createStarfield());

const spawnCarrier = (ecs: World): void => {
	const spec = SHIP_SPECS.carrier;
	const built = createShipGroup('carrier');
	const loadout = ecs.getResource('carrierLoadout');
	const carrier = ecs.spawn({
		...createGroupComponents(built.group, { x: 0, y: 0, z: 0 }),
		ship: { class: 'carrier', hp: spec.hp },
		kinematic: createKinematicState(spec, 0),
		collider: makeCollider(spec),
		commandVessel: true,
		engineGlow: { material: built.engineMaterial, mounts: built.engineMounts },
	}, { scope: 'playing' });
	spawnShipTrails(ecs, carrier.id, built.engineMounts, TRAIL_COLOR_ALLY);
	spawnShipTurrets(ecs, carrier.id, spec, built);
	applyCarrierLoadout(ecs, carrier.id, spec, built, loadout);

	const shieldCount = loadout.auxSlots.filter((s) => s.systemKind === 'shield').length;
	if (shieldCount > 0) {
		const shieldBuild = createShieldBubble(spec);
		built.group.add(shieldBuild.mesh);
		ecs.addComponent(carrier.id, 'shield', buildShieldComponent(shieldBuild, shieldCount));
	}

	installHangarOnShip(ecs, carrier.id, spec, loadout);

	const playerState = ecs.getResource('playerState');
	playerState.ownedShipIds = [carrier.id];
	playerState.commandVesselId = carrier.id;
	playerState.pendingHeading = 0;
	playerState.headingPreviewActive = false;

	ecs.getResource('camera3DState').follow(carrier);
};

game.onScreenEnter('playing', () => spawnCarrier(game));

await game.setScreen('title', {});

function requireEl(id: string): HTMLElement {
	const el = document.getElementById(id);
	if (!el) throw new Error(`HUD element #${id} not found`);
	return el;
}

function createStarfield(): Points {
	const tints: readonly (readonly [number, number, number])[] = [
		[1.0, 1.0, 1.0],
		[1.0, 1.0, 1.0],
		[1.0, 1.0, 1.0],
		[1.0, 1.0, 1.0],
		[1.0, 1.0, 1.0],
		[0.75, 0.85, 1.0],
		[0.75, 0.85, 1.0],
		[1.0, 0.88, 0.72],
	];
	const vertices = Array.from({ length: STAR_COUNT }, () => {
		const x = (Math.random() * 2 - 1) * STAR_FIELD_RADIUS;
		const z = (Math.random() * 2 - 1) * STAR_FIELD_RADIUS;
		const y = STAR_FIELD_Y_MIN + Math.random() * (STAR_FIELD_Y_MAX - STAR_FIELD_Y_MIN);
		const [tr, tg, tb] = tints[Math.floor(Math.random() * tints.length)];
		const brightness = STAR_BRIGHTNESS_MIN + Math.random() * STAR_BRIGHTNESS_RANGE;
		return [x, y, z, tr * brightness, tg * brightness, tb * brightness] as const;
	});
	const positions = new Float32Array(vertices.flatMap(([x, y, z]) => [x, y, z]));
	const colors = new Float32Array(vertices.flatMap(([, , , r, g, b]) => [r, g, b]));
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(positions, 3));
	geometry.setAttribute('color', new BufferAttribute(colors, 3));
	return new Points(geometry, new PointsMaterial({
		size: STAR_SIZE,
		sizeAttenuation: false,
		vertexColors: true,
		transparent: true,
		depthWrite: false,
	}));
}
