import Phaser from "phaser";
import type { GameState } from "./types.ts";
import { TURRET_COST, RUNNER_COST, MAX_RUNNERS } from "./config.ts";
import { createInitialState, createRunner } from "./state.ts";
import { tickWaves } from "./systems/waves.ts";
import { tickRegions } from "./systems/regions.ts";
import { tickTurrets, isValidPlacement, createTurret } from "./systems/turrets.ts";
import { tickMovement, tickCombat, tickDefense } from "./systems/combat.ts";
import { tickResourceDrops } from "./systems/resources.ts";
import { tickRunners, tickRunnerDeath } from "./systems/runners.ts";
import { findClickedTurret, resolveControlMode } from "./systems/input.ts";
import { createSpriteRegistry, syncSprites } from "./render.ts";

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
			buyRunner: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
		},
		prevPointerDown: false,
		prevToggle: false,
		prevEscape: false,
		prevBuyRunner: false,
	};

	this.input.mouse?.disableContextMenu();
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
	const pointerJustDown = pointer.isDown && !sceneState.prevPointerDown;
	const rightClicked = pointer.rightButtonDown();
	const toggleJustPressed = keys.toggle.isDown && !sceneState.prevToggle;
	const escapeJustPressed = keys.escape.isDown && !sceneState.prevEscape;
	const buyRunnerJustPressed = keys.buyRunner.isDown && !sceneState.prevBuyRunner;

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

	// Handle turret placement (costs currency)
	if (
		pointerJustDown &&
		!rightClicked &&
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
		pointer.isDown && !rightClicked,
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
