import { AmbientLight, DirectionalLight, Mesh, PlaneGeometry, MeshStandardMaterial, GridHelper } from 'three';
import { createGroupComponents } from 'ecspresso/plugins/rendering/renderer3D';
import { builder } from './types';
import { SHIP_SPECS, createShipGroup, turretFromMount } from './ships';
import { GROUND_SIZE } from './constants';
import { createCursorPlugin } from './plugins/cursor';
import { createControlPlugin } from './plugins/control';
import { createMovementPlugin } from './plugins/movement';
import { createFormationPlugin } from './plugins/formation';
import { createTurretPlugin } from './plugins/turret';
import { createCombatPlugin } from './plugins/combat';
import { createEnemyPlugin } from './plugins/enemy';
import { createWavesPlugin } from './plugins/waves';
import { createPickupsPlugin } from './plugins/pickups';
import { createSummonPlugin } from './plugins/summon';
import { createHudPlugin } from './plugins/hud';
import { createAimPreviewPlugin } from './plugins/aimPreview';

const game = builder
	.withPlugin(createCursorPlugin())
	.withPlugin(createControlPlugin())
	.withPlugin(createMovementPlugin())
	.withPlugin(createFormationPlugin())
	.withPlugin(createTurretPlugin())
	.withPlugin(createCombatPlugin())
	.withPlugin(createEnemyPlugin())
	.withPlugin(createWavesPlugin())
	.withPlugin(createPickupsPlugin())
	.withPlugin(createSummonPlugin())
	.withPlugin(createHudPlugin())
	.withPlugin(createAimPreviewPlugin())
	.build();

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

const spec = SHIP_SPECS.carrier;
const { group: carrierGroup, turretMounts } = createShipGroup('carrier');
const carrier = game.spawn({
	...createGroupComponents(carrierGroup, { x: 0, y: 0, z: 0 }),
	ship: {
		class: 'carrier',
		heading: 0,
		headingTarget: 0,
		throttle: 0,
		vx: 0,
		vz: 0,
		turnRate: spec.turnRate,
		turnSpeed: 0,
		turnAccel: spec.turnAccel,
		accel: spec.accel,
		maxSpeed: spec.maxSpeed,
		drag: spec.drag,
		hp: spec.hp,
	},
	commandVessel: true,
});

spec.turrets.forEach((mountSpec, idx) => {
	const mount = turretMounts[idx];
	if (!mount) return;
	game.spawn({ turret: turretFromMount(carrier.id, mountSpec, mount) });
});

const playerState = game.getResource('playerState');
playerState.ownedShipIds.push(carrier.id);
playerState.commandVesselId = carrier.id;

game.getResource('camera3DState').follow(carrier);

function requireEl(id: string): HTMLElement {
	const el = document.getElementById(id);
	if (!el) throw new Error(`HUD element #${id} not found`);
	return el;
}
