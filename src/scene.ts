import Phaser from "phaser";
import type { GameState } from "./types.ts";
import { TURRET_COST, RUNNER_COST, MAX_RUNNERS, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, TARGET_X, TARGET_Y } from "./config.ts";
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

	this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _dx: number, dy: number) => {
		const oldZoom = cam.zoom;
		const direction = dy < 0 ? 1 : -1;
		const newZoom = Phaser.Math.Clamp(oldZoom + direction * ZOOM_STEP * oldZoom, ZOOM_MIN, ZOOM_MAX);

		// Keep world point under mouse fixed across zoom change
		const sx = _pointer.x - VIEWPORT_WIDTH / 2;
		const sy = _pointer.y - VIEWPORT_HEIGHT / 2;
		cam.scrollX += sx * (1 / oldZoom - 1 / newZoom);
		cam.scrollY += sy * (1 / oldZoom - 1 / newZoom);
		cam.setZoom(newZoom);
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

	const clickedTurret =
		pointerJustDown && !rightDown
			? findClickedTurret(pointerPosition, state.turrets)
			: null;

	state = {
		...state,
		controlMode: resolveControlMode(
			state.controlMode,
			toggleJustPressed,
			escapeJustPressed,
			clickedTurret,
			pointerJustDown,
		),
	};

	if (
		pointerJustDown &&
		!rightDown &&
		state.controlMode.tag === "none" &&
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

	state = tickWaves(state, delta);
	state = tickRegions(state, delta);
	state = tickTurrets(state, pointerPosition, pointer.isDown && !rightDown, time, delta);
	state = tickMovement(state, delta);

	const combatResult = tickCombat(state);
	state = tickResourceDrops(combatResult.state, combatResult.destroyedEnemyPositions);

	state = tickRunners(state, delta);
	state = tickRunnerDeath(state);
	state = tickDefense(state);

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
