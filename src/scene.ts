import Phaser from "phaser";
import type { GameState, PlacementState } from "./types.ts";
import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, TARGET_X, TARGET_Y } from "./config.ts";
import { createInitialState } from "./state.ts";
import { findClickedTurret, resolveControlMode } from "./systems/input.ts";
import { tickPlacement, adjustArcWidth } from "./systems/placement.ts";
import { tickGameSystems } from "./systems/gameLoop.ts";
import { createSpriteRegistry, syncSprites } from "./render.ts";

const ZOOM_MIN = Math.max(VIEWPORT_WIDTH / WORLD_WIDTH, VIEWPORT_HEIGHT / WORLD_HEIGHT);
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const PAN_SPEED = 500;

type SceneState = {
	gameState: GameState;
	registry: ReturnType<typeof createSpriteRegistry>;
	keys: {
		toggle: Phaser.Input.Keyboard.Key;
		escape: Phaser.Input.Keyboard.Key;
		buyRunner: Phaser.Input.Keyboard.Key;
		togglePriority: Phaser.Input.Keyboard.Key;
		placeBlock: Phaser.Input.Keyboard.Key;
		panLeft: readonly Phaser.Input.Keyboard.Key[];
		panRight: readonly Phaser.Input.Keyboard.Key[];
		panUp: readonly Phaser.Input.Keyboard.Key[];
		panDown: readonly Phaser.Input.Keyboard.Key[];
	};
	placement: PlacementState;
	prevPointerDown: boolean;
	prevToggle: boolean;
	prevEscape: boolean;
	prevBuyRunner: boolean;
	prevTogglePriority: boolean;
	prevPlaceBlock: boolean;
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
	cam.setZoom(ZOOM_MAX * 0.15);
	cam.centerOn(TARGET_X, TARGET_Y);

	sceneState = {
		gameState: createInitialState(),
		registry: createSpriteRegistry(this),
		keys: {
			toggle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T),
			escape: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
			buyRunner: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
			togglePriority: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
			placeBlock: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B),
			panLeft: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)] as const,
			panRight: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)] as const,
			panUp: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)] as const,
			panDown: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)] as const,
		},
		placement: { tag: "idle" },
		prevPointerDown: false,
		prevToggle: false,
		prevEscape: false,
		prevBuyRunner: false,
		prevTogglePriority: false,
		prevPlaceBlock: false,
		isPanning: false,
		panStart: { x: 0, y: 0 },
		cameraStart: { x: 0, y: 0 },
	};

	this.input.mouse?.disableContextMenu();

	this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _dx: number, dy: number) => {
		if (!sceneState) return;

		if (sceneState.placement.tag === "aiming") {
			sceneState = {
				...sceneState,
				placement: adjustArcWidth(sceneState.placement, dy),
			};
			return;
		}

		const oldZoom = cam.zoom;
		const direction = dy < 0 ? 1 : -1;
		const newZoom = Phaser.Math.Clamp(oldZoom + direction * ZOOM_STEP * oldZoom, ZOOM_MIN, ZOOM_MAX);

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
		syncSprites(this, sceneState.registry, state, { x: 0, y: 0 }, time, sceneState.placement);
		return;
	}

	const pointer = this.input.activePointer;
	const pointerPosition = { x: pointer.worldX, y: pointer.worldY };
	const rightDown = pointer.rightButtonDown();
	const toggleJustPressed = keys.toggle.isDown && !sceneState.prevToggle;
	const escapeJustPressed = keys.escape.isDown && !sceneState.prevEscape;
	const buyRunnerJustPressed = keys.buyRunner.isDown && !sceneState.prevBuyRunner;
	const priorityJustPressed = keys.togglePriority.isDown && !sceneState.prevTogglePriority;
	const placeBlockJustPressed = keys.placeBlock.isDown && !sceneState.prevPlaceBlock;

	// Camera panning
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

	const panPx = (PAN_SPEED * delta) / (1000 * cam.zoom);
	if (keys.panLeft.some(k => k.isDown)) cam.scrollX -= panPx;
	if (keys.panRight.some(k => k.isDown)) cam.scrollX += panPx;
	if (keys.panUp.some(k => k.isDown)) cam.scrollY -= panPx;
	if (keys.panDown.some(k => k.isDown)) cam.scrollY += panPx;

	// Input detection
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

	// Placement & economy
	const placementResult = tickPlacement(sceneState.placement, state, {
		pointerPosition,
		pointerDown: pointer.isDown && !rightDown,
		pointerJustDown,
		rightDown,
		escapeJustPressed,
		toggleJustPressed,
		placeBlockJustPressed,
		buyRunnerJustPressed,
		priorityJustPressed,
		clickedTurret,
	});
	state = placementResult.state;

	// Game systems
	state = tickGameSystems(state, {
		pointerPosition,
		pointerDown: pointer.isDown && !rightDown,
		time,
		delta,
	});

	syncSprites(this, sceneState.registry, state, pointerPosition, time, placementResult.placement);

	sceneState = {
		...sceneState,
		gameState: state,
		placement: placementResult.placement,
		prevPointerDown: pointer.isDown,
		prevToggle: keys.toggle.isDown,
		prevEscape: keys.escape.isDown,
		prevBuyRunner: keys.buyRunner.isDown,
		prevTogglePriority: keys.togglePriority.isDown,
		prevPlaceBlock: keys.placeBlock.isDown,
	};
}

export const sceneConfig = { create, update };
