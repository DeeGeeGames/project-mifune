import type { GameState, Runner } from "../types.ts";
import {
	TARGET_X,
	TARGET_Y,
	RUNNER_PICKUP_DISTANCE,
	RUNNER_BASE_ARRIVE_DISTANCE,
	RUNNER_RADIUS,
	ENEMY_RADIUS,
	TURRET_RELOAD_THRESHOLD,
	TURRET_MAX_AMMO,
	RUNNER_RELOAD_AMOUNT,
} from "../config.ts";
import { distance, findNearest } from "./targeting.ts";

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

export function tickRunners(state: GameState, delta: number): GameState {
	const dt = delta / 1000;

	const claimedIds = new Set(
		state.runners
			.filter((r): r is Runner & { state: { tag: "collecting" } } => r.state.tag === "collecting")
			.map((r) => r.state.targetId),
	);

	const claimedTurretIds = new Set(
		state.runners
			.filter((r): r is Runner & { state: { tag: "resupplying" } } => r.state.tag === "resupplying")
			.map((r) => r.state.targetId),
	);

	const pickedUpResourceIds = new Set<string>();
	let currencyGained = 0;
	const turretReloads = new Map<string, number>();

	const findResourceTask = (runner: Runner): Runner | null => {
		const unclaimed = state.resources.filter((r) => !claimedIds.has(r.id));
		const target = findNearest(runner.position, unclaimed, (r) => r.position);
		if (!target) return null;
		claimedIds.add(target.id);
		return { ...runner, state: { tag: "collecting" as const, targetId: target.id } };
	};

	const turretsNeedingAmmo = state.turrets.filter(
		(t) => t.ammo <= TURRET_RELOAD_THRESHOLD,
	);

	const findAmmoTask = (runner: Runner): Runner | null => {
		if (distance(runner.position, BASE_POS) > RUNNER_BASE_ARRIVE_DISTANCE) return null;
		const available = turretsNeedingAmmo.filter((t) => !claimedTurretIds.has(t.id));
		const target = findNearest(runner.position, available, (t) => t.position);
		if (!target) return null;
		claimedTurretIds.add(target.id);
		return { ...runner, state: { tag: "resupplying" as const, targetId: target.id } };
	};

	const updatedRunners = state.runners.map((runner) => {
		const runnerState = runner.state;

		if (runnerState.tag === "idle") {
			const [primary, secondary] = state.runnerPriority === "ammo"
				? [() => findAmmoTask(runner), () => findResourceTask(runner)]
				: [() => findResourceTask(runner), () => findAmmoTask(runner)];

			return primary() ?? secondary() ?? runner;
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

		if (runnerState.tag === "returning") {
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
		}

		// resupplying
		const targetTurret = state.turrets.find((t) => t.id === runnerState.targetId);
		if (!targetTurret) {
			return { ...runner, state: { tag: "idle" as const } };
		}

		const newPos = moveToward(runner.position, targetTurret.position, runner.speed, dt);
		if (distance(newPos, targetTurret.position) < RUNNER_BASE_ARRIVE_DISTANCE) {
			turretReloads.set(targetTurret.id, RUNNER_RELOAD_AMOUNT);
			return {
				...runner,
				position: newPos,
				state: { tag: "idle" as const },
			};
		}
		return { ...runner, position: newPos };
	});

	const reloadedTurrets = turretReloads.size > 0
		? state.turrets.map((t) => {
			const reloadAmount = turretReloads.get(t.id);
			if (reloadAmount === undefined) return t;
			return { ...t, ammo: Math.min(TURRET_MAX_AMMO, t.ammo + reloadAmount) };
		})
		: state.turrets;

	return {
		...state,
		runners: updatedRunners,
		turrets: reloadedTurrets,
		resources: state.resources.filter((r) => !pickedUpResourceIds.has(r.id)),
		currency: state.currency + currencyGained,
	};
}

export function tickRunnerDeath(state: GameState): GameState {
	const contactDistance = RUNNER_RADIUS + ENEMY_RADIUS;
	const alive = state.runners.filter((runner) =>
		!state.enemies.some((enemy) => distance(runner.position, enemy.position) < contactDistance),
	);
	if (alive.length === state.runners.length) return state;
	return { ...state, runners: alive };
}
