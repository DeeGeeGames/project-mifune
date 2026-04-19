import { AmbientLight, DirectionalLight, Mesh, PlaneGeometry, MeshStandardMaterial, GridHelper } from 'three';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { builder, type World } from './types';
import { SHIP_SPECS, createShipGroup, spawnShipTurrets } from './ships';
import { createKinematicState } from './kinematic';
import { GROUND_SIZE } from './constants';
import { createCursorPlugin } from './plugins/cursor';
import { createControlPlugin } from './plugins/control';
import { createMovementPlugin } from './plugins/movement';
import { createFormationPlugin } from './plugins/formation';
import { createTurretPlugin } from './plugins/turret';
import { createMissilePlugin } from './plugins/missile';
import { createCombatPlugin } from './plugins/combat';
import { createEnemyPlugin } from './plugins/enemy';
import { createThreatPlugin } from './plugins/threat';
import { createWavesPlugin } from './plugins/waves';
import { createPickupsPlugin } from './plugins/pickups';
import { createSummonPlugin } from './plugins/summon';
import { createHudPlugin } from './plugins/hud';
import { createAimPreviewPlugin } from './plugins/aimPreview';
import { createHealthBarsPlugin } from './plugins/healthBars';
import { createWaveSummaryPlugin } from './plugins/waveSummary';

const game = builder
	.withPlugin(createCursorPlugin())
	.withPlugin(createControlPlugin())
	.withPlugin(createMovementPlugin())
	.withPlugin(createFormationPlugin())
	.withPlugin(createTurretPlugin())
	.withPlugin(createMissilePlugin())
	.withPlugin(createCombatPlugin())
	.withPlugin(createThreatPlugin())
	.withPlugin(createEnemyPlugin())
	.withPlugin(createWavesPlugin())
	.withPlugin(createPickupsPlugin())
	.withPlugin(createSummonPlugin())
	.withPlugin(createHudPlugin())
	.withPlugin(createAimPreviewPlugin())
	.withPlugin(createHealthBarsPlugin())
	.withPlugin(createWaveSummaryPlugin())
	.build();

const gameHudIds = ['hud-resources', 'hud-roster', 'hud-menu', 'hud-thrust', 'hud-help', 'hud-wave'] as const;

game.addResource('playerState', {
	resources: 500,
	ownedShipIds: [],
	commandVesselId: -1,
	selectedSummon: 'frigate',
	pendingHeading: 0,
	headingPreviewActive: false,
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
});

await game.initialize();

const scene = game.getResource('scene');
scene.add(new AmbientLight(0xffffff, 0.55));
const sun = new DirectionalLight(0xffffff, 0.8);
sun.position.set(30, 50, 20);
scene.add(sun);

const ground = new Mesh(
	new PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
	new MeshStandardMaterial({ color: 0x1a2030, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const grid = new GridHelper(GROUND_SIZE, 100, 0x2a3550, 0x1a2535);
grid.position.y = 0.01;
scene.add(grid);

const TEARDOWN_COMPONENTS = ['projectile', 'missile', 'pickup', 'turret', 'missileTurret', 'summonAnim', 'enemy', 'ship'] as const;

const spawnCarrier = (ecs: World): void => {
	const spec = SHIP_SPECS.carrier;
	const { group: carrierGroup, turretMounts, missileTurretMounts } = createShipGroup('carrier');
	const carrier = ecs.spawn({
		...createGroupComponents(carrierGroup, { x: 0, y: 0, z: 0 }),
		ship: { class: 'carrier', hp: spec.hp },
		kinematic: createKinematicState(spec, 0),
		commandVessel: true,
	});
	spawnShipTurrets(ecs, carrier.id, spec, { group: carrierGroup, turretMounts, missileTurretMounts });

	const playerState = ecs.getResource('playerState');
	playerState.ownedShipIds = [carrier.id];
	playerState.commandVesselId = carrier.id;
	playerState.pendingHeading = 0;
	playerState.headingPreviewActive = false;

	ecs.getResource('camera3DState').follow(carrier);
};

const teardownSim = (ecs: World): void => {
	const seen = new Set<number>();
	TEARDOWN_COMPONENTS.forEach((component) => {
		ecs.getEntitiesWithQuery([component]).forEach(({ id }) => {
			if (seen.has(id)) return;
			seen.add(id);
			ecs.removeEntity(id);
		});
	});
};

game.eventBus.subscribe('screenEnter', ({ screen }) => {
	if (screen === 'playing') spawnCarrier(game);
});

game.eventBus.subscribe('screenExit', ({ screen }) => {
	if (screen === 'playing') teardownSim(game);
});

await game.setScreen('playing', { waveNumber: 1 });

function requireEl(id: string): HTMLElement {
	const el = document.getElementById(id);
	if (!el) throw new Error(`HUD element #${id} not found`);
	return el;
}
