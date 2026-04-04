import Phaser from "phaser";
import type { GameState } from "./types.ts";
import { TURRET_COST, RUNNER_COST, MAX_RUNNERS, WORLD_WIDTH, WORLD_HEIGHT, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, TARGET_X, TARGET_Y } from "./config.ts";
import { createInitialState, createRunner } from "./state.ts";
import { tickWaves } from "./systems/waves.ts";
import { tickRegions } from "./systems/regions.ts";
import { tickTurrets, isValidPlacement, createTurret } from "./systems/turrets.ts";
import { tickMovement, tickCombat, tickDefense } from "./systems/combat.ts";
import { tickResourceDrops } from "./systems/resources.ts";
import { tickRunners, tickRunnerDeath } from "./systems/runners.ts";
import { findClickedTurret, resolveControlMode } from "./systems/input.ts";
import { createSpriteRegistry, syncSprites } from "./render.ts";

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;

type SceneState = {
	gameState: GameState;
	registry: ReturnType<typeof createSpriteRegistry>;
	keys: {
		toggle: Phaser.Input.Keyboard.Key;
		escape: Phaser.Input.Keyboard.Key;
		buyRunner: Phaser.Input.Keyboard.Key;
	};
	prevPointerDown: boolean;
	prevToggle: boolean;
	prevEscape: boolean;
	prevBuyRunner: boolean;
	isPanning: boolean;
	panStart: { x: number; y: number };
	cameraStart: { x: number; y: number };
};

let sceneState: SceneState | null = null;

function create(this: Phaser.Scene): void {
	const keyboard = this.input.keyboard;
	if (!keyboard) throw new Error("Keyboard input not available");

	const cam = this.cameras.main;
	cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	cam.centerOn(TARGET_X, TARGET_Y);

	sceneState = {
		gameState: createInitialState(),
		registry: createSpriteRegistry(this),
		keys: {
			toggle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T),
			escape: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
			buyRunner: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
		},
		prevPointerDown: false,
		prevToggle: false,
		prevEscape: false,
		prevBuyRunner: false,
		isPanning: false,
		panStart: { x: 0, y: 0 },
		cameraStart: { x: 0, y: 0 },
	};

	this.input.mouse?.disableContextMenu();

	// Zoom centered on mouse
	this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _dx: number, dy: number) => {
		const worldBefore = { x: _pointer.worldX, y: _pointer.worldY };
		const direction = dy < 0 ? 1 : -1;
		const newZoom = Phaser.Math.Clamp(cam.zoom + direction * ZOOM_STEP * cam.zoom, ZOOM_MIN, ZOOM_MAX);
		cam.setZoom(newZoom);
		// After zoom, recalculate where the mouse now points in world space
		// and shift the camera so the world point under the mouse stays fixed
		const worldAfter = cam.getWorldPoint(_pointer.x, _pointer.y);
		cam.scrollX += worldBefore.x - worldAfter.x;
		cam.scrollY += worldBefore.y - worldAfter.y;
	});
}

function update(this: Phaser.Scene, time: number, delta: number): void {
	if (!sceneState) return;
	const { keys } = sceneState;
	let state = sceneState.gameState;

	if (state.gameOver) {
		syncSprites(this, sceneState.registry, state, { x: 0, y: 0 }, time);
		return;
	}

	const pointer = this.input.activePointer;
	const pointerPosition = { x: pointer.worldX, y: pointer.worldY };
	const rightDown = pointer.rightButtonDown();
	const toggleJustPressed = keys.toggle.isDown && !sceneState.prevToggle;
	const escapeJustPressed = keys.escape.isDown && !sceneState.prevEscape;
	const buyRunnerJustPressed = keys.buyRunner.isDown && !sceneState.prevBuyRunner;

	// Right-click pan
	const cam = this.cameras.main;
	if (rightDown && !sceneState.isPanning) {
		sceneState = {
			...sceneState,
			isPanning: true,
			panStart: { x: pointer.x, y: pointer.y },
			cameraStart: { x: cam.scrollX, y: cam.scrollY },
		};
	} else if (rightDown && sceneState.isPanning) {
		cam.scrollX = sceneState.cameraStart.x + (sceneState.panStart.x - pointer.x) / cam.zoom;
		cam.scrollY = sceneState.cameraStart.y + (sceneState.panStart.y - pointer.y) / cam.zoom;
	} else if (!rightDown && sceneState.isPanning) {
		sceneState = { ...sceneState, isPanning: false };
	}

	const pointerJustDown = pointer.isDown && !sceneState.prevPointerDown && !rightDown;

	// Resolve control mode
	const clickedTurret =
		pointerJustDown && !rightDown
			? findClickedTurret(pointerPosition, state.turrets)
			: null;

	const newControlMode = resolveControlMode(
		state.controlMode,
		toggleJustPressed,
		escapeJustPressed,
		false,
		clickedTurret,
		pointerJustDown,
	);
	state = { ...state, controlMode: newControlMode };

	// Handle turret placement (costs currency)
	if (
		pointerJustDown &&
		!rightDown &&
		newControlMode.tag === "none" &&
		!clickedTurret &&
		state.currency >= TURRET_COST &&
		isValidPlacement(pointerPosition, state.turrets)
	) {
		const turret = createTurret(pointerPosition);
		state = {
			...state,
			turrets: [...state.turrets, turret],
			currency: state.currency - TURRET_COST,
		};
	}

	// Handle runner purchase
	if (
		buyRunnerJustPressed &&
		state.currency >= RUNNER_COST &&
		state.runners.length < MAX_RUNNERS
	) {
		state = {
			...state,
			runners: [...state.runners, createRunner()],
			currency: state.currency - RUNNER_COST,
		};
	}

	// Tick waves (spawn regions)
	const waveResult = tickWaves(state, delta);
	state = waveResult.state;

	// Tick regions (age, spawn enemies)
	const regionResult = tickRegions(state, delta);
	state = regionResult.state;

	// Tick turrets (fire bullets)
	const turretResult = tickTurrets(
		state,
		pointerPosition,
		pointer.isDown && !rightDown,
		time,
		delta,
	);
	state = {
		...turretResult.state,
		bullets: [...turretResult.state.bullets, ...turretResult.bullets],
	};

	// Tick movement
	state = tickMovement(state, delta);

	// Tick combat (bullets vs enemies and regions)
	const combatResult = tickCombat(state);
	state = combatResult.state;

	// Drop resources from dead enemies
	state = tickResourceDrops(state, combatResult.destroyed.destroyedEnemyPositions);

	// Tick runners (collect resources, return to base)
	state = tickRunners(state, delta);

	// Kill runners touched by enemies
	const runnerDeathResult = tickRunnerDeath(state);
	state = runnerDeathResult.state;

	// Tick defense breach
	const defenseResult = tickDefense(state);
	state = defenseResult.state;

	// Sync to Phaser
	syncSprites(this, sceneState.registry, state, pointerPosition, time);

	sceneState = {
		...sceneState,
		gameState: state,
		prevPointerDown: pointer.isDown,
		prevToggle: keys.toggle.isDown,
		prevEscape: keys.escape.isDown,
		prevBuyRunner: keys.buyRunner.isDown,
	};
}

export const sceneConfig = { create, update };
