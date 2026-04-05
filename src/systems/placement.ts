import type { GameState, MenuAction, PlacementState, Turret, Vec2 } from "../types.ts";
import {
	TURRET_COST,
	BLOCK_COST,
	ARC_WIDTH_DEFAULT,
	ARC_WIDTH_MIN,
	ARC_SCROLL_STEP,
	GROUND_Y,
	GROUND_ARC_RANGE,
	RUNNER_COST,
	MAX_RUNNERS,
	MENU_BUTTON_DEFS,
} from "../config.ts";
import { createRunner } from "../state.ts";
import { isValidPlacement, createTurret } from "./turrets.ts";
import { aimAngle, clampArcCenterToRange } from "./targeting.ts";
import {
	createBlock,
	snapToBlockGrid,
	isValidBlockPlacement,
	findClickedBlockFace,
	faceCenterPosition,
	faceArcRange,
	BLOCK_HALF,
} from "./blocks.ts";

export type PlacementInput = {
	readonly pointerPosition: Vec2;
	readonly pointerDown: boolean;
	readonly pointerJustDown: boolean;
	readonly rightDown: boolean;
	readonly escapeJustPressed: boolean;
	readonly toggleJustPressed: boolean;
	readonly priorityJustPressed: boolean;
	readonly menuAction: MenuAction | null;
	readonly clickedTurret: Turret | null;
};

export type PlacementResult = {
	readonly placement: PlacementState;
	readonly state: GameState;
};

export function adjustArcWidth(
	placement: PlacementState & { tag: "aiming" },
	scrollDeltaY: number,
): PlacementState {
	const direction = scrollDeltaY < 0 ? 1 : -1;
	const newWidth = Math.max(
		ARC_WIDTH_MIN,
		Math.min(
			placement.arcWidth + direction * ARC_SCROLL_STEP,
			placement.arcRange.width,
		),
	);
	return { ...placement, arcWidth: newWidth };
}

function tickCancellation(
	placement: PlacementState,
	input: PlacementInput,
): PlacementState {
	if (
		(placement.tag === "aiming" || placement.tag === "placingBlock" || placement.tag === "placingTurret") &&
		(input.escapeJustPressed || input.toggleJustPressed)
	) {
		return { tag: "idle" };
	}
	return placement;
}

function tickEnterTurretMode(
	placement: PlacementState,
	state: GameState,
	input: PlacementInput,
): PlacementState {
	if (
		placement.tag === "idle" &&
		input.menuAction === "turret" &&
		state.controlMode.tag === "none" &&
		state.currency >= TURRET_COST
	) {
		return { tag: "placingTurret" };
	}
	return placement;
}

function tickEnterBlockMode(
	placement: PlacementState,
	state: GameState,
	input: PlacementInput,
): PlacementState {
	if (
		placement.tag === "idle" &&
		input.menuAction === "block" &&
		state.controlMode.tag === "none" &&
		state.currency >= BLOCK_COST
	) {
		return { tag: "placingBlock" };
	}
	return placement;
}

function tickBlockPlacement(
	placement: PlacementState,
	state: GameState,
	input: PlacementInput,
): PlacementResult {
	if (placement.tag !== "placingBlock" || !input.pointerDown || input.rightDown) {
		return { placement, state };
	}

	const snapped = snapToBlockGrid(input.pointerPosition, state.blocks);
	const cursorInSnapped =
		Math.abs(snapped.x - input.pointerPosition.x) <= BLOCK_HALF &&
		Math.abs(snapped.y - input.pointerPosition.y) <= BLOCK_HALF;

	if (!cursorInSnapped || !isValidBlockPlacement(snapped, state.blocks) || state.currency < BLOCK_COST) {
		return { placement, state };
	}

	const newState = {
		...state,
		blocks: [...state.blocks, createBlock(snapped)],
		currency: state.currency - BLOCK_COST,
	};

	const newPlacement: PlacementState =
		newState.currency < BLOCK_COST ? { tag: "idle" } : placement;

	return { placement: newPlacement, state: newState };
}

function tickEnterAiming(
	placement: PlacementState,
	state: GameState,
	input: PlacementInput,
): PlacementState {
	if (placement.tag !== "placingTurret") return placement;
	if (!input.pointerJustDown || input.rightDown) return placement;
	if (state.currency < TURRET_COST) return placement;

	const blockFace = findClickedBlockFace(input.pointerPosition, state.blocks);
	if (blockFace) {
		const pos = faceCenterPosition(blockFace.block, blockFace.face);
		const arcRange = faceArcRange(blockFace.face);
		return {
			tag: "aiming",
			position: pos,
			arcWidth: Math.min(ARC_WIDTH_DEFAULT, arcRange.width),
			arcRange,
			parentBlockId: blockFace.block.id,
		};
	}

	if (isValidPlacement(input.pointerPosition, state.turrets)) {
		return {
			tag: "aiming",
			position: { x: input.pointerPosition.x, y: GROUND_Y },
			arcWidth: Math.min(ARC_WIDTH_DEFAULT, GROUND_ARC_RANGE.width),
			arcRange: GROUND_ARC_RANGE,
			parentBlockId: null,
		};
	}

	return placement;
}

function tickConfirmAiming(
	placement: PlacementState,
	state: GameState,
	input: PlacementInput,
): PlacementResult {
	if (placement.tag !== "aiming" || !input.pointerJustDown || input.rightDown) {
		return { placement, state };
	}

	const rawCenter = aimAngle(placement.position, input.pointerPosition);
	const arcCenter = clampArcCenterToRange(
		rawCenter,
		placement.arcWidth,
		placement.arcRange.center,
		placement.arcRange.width,
	);
	const turret = createTurret(
		placement.position,
		arcCenter,
		placement.arcWidth,
		placement.arcRange,
		placement.parentBlockId,
	);

	const newCurrency = state.currency - TURRET_COST;
	return {
		placement: newCurrency >= TURRET_COST ? { tag: "placingTurret" } : { tag: "idle" },
		state: {
			...state,
			turrets: [...state.turrets, turret],
			currency: newCurrency,
		},
	};
}

function tickBuyRunner(state: GameState, input: PlacementInput): GameState {
	if (
		input.menuAction === "runner" &&
		state.currency >= RUNNER_COST &&
		state.runners.length < MAX_RUNNERS
	) {
		return {
			...state,
			runners: [...state.runners, createRunner()],
			currency: state.currency - RUNNER_COST,
		};
	}
	return state;
}

function tickPriorityToggle(state: GameState, input: PlacementInput): GameState {
	if (input.priorityJustPressed) {
		return {
			...state,
			runnerPriority: state.runnerPriority === "resources" ? "ammo" : "resources",
		};
	}
	return state;
}

export function tickPlacement(
	placement: PlacementState,
	state: GameState,
	input: PlacementInput,
): PlacementResult {
	const cancelled = tickCancellation(placement, input);
	const withTurretMode = tickEnterTurretMode(cancelled, state, input);
	const withBlockMode = tickEnterBlockMode(withTurretMode, state, input);
	const blockResult = tickBlockPlacement(withBlockMode, state, input);
	const withAiming = tickEnterAiming(blockResult.placement, blockResult.state, input);
	const aimResult = tickConfirmAiming(withAiming, blockResult.state, input);
	const withPriority = tickPriorityToggle(aimResult.state, input);
	const withRunner = tickBuyRunner(withPriority, input);

	return { placement: aimResult.placement, state: withRunner };
}

export type MenuButtonState = {
	readonly action: MenuAction;
	readonly enabled: boolean;
	readonly active: boolean;
	readonly label: string;
};

function menuButtonEnabled(action: MenuAction, state: GameState): boolean {
	const enabledCheck: Record<MenuAction, () => boolean> = {
		turret: () => state.currency >= TURRET_COST && state.controlMode.tag === "none",
		block: () => state.currency >= BLOCK_COST && state.controlMode.tag === "none",
		runner: () => state.currency >= RUNNER_COST && state.runners.length < MAX_RUNNERS,
	};
	return enabledCheck[action]();
}

function menuButtonActive(action: MenuAction, placement: PlacementState): boolean {
	const activeCheck: Record<MenuAction, () => boolean> = {
		turret: () => placement.tag === "placingTurret" || placement.tag === "aiming",
		block: () => placement.tag === "placingBlock",
		runner: () => false,
	};
	return activeCheck[action]();
}

export function computeMenuState(
	state: GameState,
	placement: PlacementState,
): ReadonlyArray<MenuButtonState> {
	return MENU_BUTTON_DEFS.map((def) => ({
		action: def.action,
		enabled: menuButtonEnabled(def.action, state),
		active: menuButtonActive(def.action, placement),
		label: `${def.label}  $${def.cost}`,
	}));
}
