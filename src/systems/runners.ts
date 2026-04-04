import type { GameState, Runner, Resource } from "../types.ts";
import {
	TARGET_X,
	TARGET_Y,
	RUNNER_PICKUP_DISTANCE,
	RUNNER_BASE_ARRIVE_DISTANCE,
	RUNNER_RADIUS,
	ENEMY_RADIUS,
} from "../config.ts";
import { distance } from "./targeting.ts";

const BASE_POS = { x: TARGET_X, y: TARGET_Y };

function moveToward(
	from: { x: number; y: number },
	to: { x: number; y: number },
	speed: number,
	dt: number,
): { x: number; y: number } {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const dist = Math.sqrt(dx * dx + dy * dy);
	if (dist < 1) return from;
	const step = Math.min(speed * dt, dist);
	return {
		x: from.x + (dx / dist) * step,
		y: from.y + (dy / dist) * step,
	};
}

function findNearestUnclaimed(
	runner: Runner,
	resources: ReadonlyArray<Resource>,
	claimedIds: ReadonlySet<string>,
): Resource | null {
	const available = resources.filter((r) => !claimedIds.has(r.id));
	if (available.length === 0) return null;

	return available.reduce((nearest, r) =>
		distance(runner.position, r.position) < distance(runner.position, nearest.position)
			? r
			: nearest,
	);
}

export function tickRunners(
	state: GameState,
	delta: number,
): GameState {
	const dt = delta / 1000;

	// Build set of already-claimed resource IDs (from runners already targeting them)
	const claimedIds = new Set(
		state.runners
			.filter((r): r is Runner & { state: { tag: "collecting" } } => r.state.tag === "collecting")
			.map((r) => r.state.targetId),
	);

	const pickedUpResourceIds = new Set<string>();
	let currencyGained = 0;

	const updatedRunners = state.runners.map((runner) => {
		const runnerState = runner.state;

		if (runnerState.tag === "idle") {
			const target = findNearestUnclaimed(runner, state.resources, claimedIds);
			if (!target) return runner;
			claimedIds.add(target.id);
			return { ...runner, state: { tag: "collecting" as const, targetId: target.id } };
		}

		if (runnerState.tag === "collecting") {
			const targetResource = state.resources.find((r) => r.id === runnerState.targetId);
			if (!targetResource || pickedUpResourceIds.has(runnerState.targetId)) {
				return { ...runner, state: { tag: "idle" as const } };
			}

			const newPos = moveToward(runner.position, targetResource.position, runner.speed, dt);
			if (distance(newPos, targetResource.position) < RUNNER_PICKUP_DISTANCE) {
				pickedUpResourceIds.add(targetResource.id);
				return {
					...runner,
					position: newPos,
					state: { tag: "returning" as const, carrying: targetResource.value },
				};
			}
			return { ...runner, position: newPos };
		}

		// returning
		const newPos = moveToward(runner.position, BASE_POS, runner.speed, dt);
		if (distance(newPos, BASE_POS) < RUNNER_BASE_ARRIVE_DISTANCE) {
			currencyGained += runnerState.carrying;
			return {
				...runner,
				position: { ...BASE_POS },
				state: { tag: "idle" as const },
			};
		}
		return { ...runner, position: newPos };
	});

	const resources = state.resources.filter((r) => !pickedUpResourceIds.has(r.id));

	return {
		...state,
		runners: updatedRunners,
		resources,
		currency: state.currency + currencyGained,
	};
}

export function tickRunnerDeath(
	state: GameState,
): { state: GameState; deadRunnerIds: ReadonlyArray<string> } {
	const contactDistance = RUNNER_RADIUS + ENEMY_RADIUS;
	const deadIds = new Set<string>();

	state.runners.forEach((runner) => {
		const hit = state.enemies.some(
			(enemy) => distance(runner.position, enemy.position) < contactDistance,
		);
		if (hit) deadIds.add(runner.id);
	});

	if (deadIds.size === 0) return { state, deadRunnerIds: [] };

	return {
		state: {
			...state,
			runners: state.runners.filter((r) => !deadIds.has(r.id)),
		},
		deadRunnerIds: [...deadIds],
	};
}
