import Phaser from "phaser";
import type { GameState, ControlMode } from "./types.ts";
import { createInitialState } from "./state.ts";
import { tickWaves } from "./systems/waves.ts";
import { tickTurrets, isValidPlacement, createTurret } from "./systems/turrets.ts";
import { tickMovement, tickCombat, tickDefense } from "./systems/combat.ts";
import { findClickedTurret, resolveControlMode } from "./systems/input.ts";
import { createSpriteRegistry, syncSprites } from "./render.ts";

type SceneState = {
	gameState: GameState;
	registry: ReturnType<typeof createSpriteRegistry>;
	keys: {
		toggle: Phaser.Input.Keyboard.Key;
		escape: Phaser.Input.Keyboard.Key;
	};
	prevPointerDown: boolean;
	prevToggle: boolean;
	prevEscape: boolean;
};

let sceneState: SceneState | null = null;

function create(this: Phaser.Scene): void {
	const keyboard = this.input.keyboard;
	if (!keyboard) throw new Error("Keyboard input not available");

	sceneState = {
		gameState: createInitialState(),
		registry: createSpriteRegistry(this),
		keys: {
			toggle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T),
			escape: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
		},
		prevPointerDown: false,
		prevToggle: false,
		prevEscape: false,
	};

	this.input.mouse?.disableContextMenu();
}

function update(this: Phaser.Scene, time: number, delta: number): void {
	if (!sceneState) return;
	const { keys } = sceneState;
	let state = sceneState.gameState;

	if (state.gameOver) {
		syncSprites(this, sceneState.registry, state, { x: 0, y: 0 });
		return;
	}

	const pointer = this.input.activePointer;
	const pointerPosition = { x: pointer.worldX, y: pointer.worldY };
	const pointerJustDown = pointer.isDown && !sceneState.prevPointerDown;
	const rightClicked = pointer.rightButtonDown();
	const toggleJustPressed = keys.toggle.isDown && !sceneState.prevToggle;
	const escapeJustPressed = keys.escape.isDown && !sceneState.prevEscape;

	// Resolve control mode
	const clickedTurret =
		pointerJustDown && !rightClicked
			? findClickedTurret(pointerPosition, state.turrets)
			: null;

	const newControlMode = resolveControlMode(
		state.controlMode,
		toggleJustPressed,
		escapeJustPressed,
		rightClicked,
		clickedTurret,
		pointerJustDown,
	);
	state = { ...state, controlMode: newControlMode };

	// Handle turret placement
	if (
		pointerJustDown &&
		!rightClicked &&
		newControlMode.tag === "none" &&
		!clickedTurret &&
		isValidPlacement(pointerPosition, state.turrets)
	) {
		const turret = createTurret(pointerPosition);
		state = { ...state, turrets: [...state.turrets, turret] };
	}

	// Tick waves (spawn enemies)
	const waveResult = tickWaves(state, delta);
	state = waveResult.state;

	// Tick turrets (fire bullets)
	const turretResult = tickTurrets(
		state,
		pointerPosition,
		pointer.isDown && !rightClicked,
		time,
	);
	state = {
		...turretResult.state,
		bullets: [...turretResult.state.bullets, ...turretResult.bullets],
	};

	// Tick movement
	state = tickMovement(state, delta);

	// Tick combat
	const combatResult = tickCombat(state);
	state = combatResult.state;

	// Tick defense breach
	const defenseResult = tickDefense(state);
	state = defenseResult.state;

	// Sync to Phaser
	syncSprites(this, sceneState.registry, state, pointerPosition);

	// Store state for next frame
	sceneState = {
		...sceneState,
		gameState: state,
		prevPointerDown: pointer.isDown,
		prevToggle: keys.toggle.isDown,
		prevEscape: keys.escape.isDown,
	};
}

export const sceneConfig = { create, update };
