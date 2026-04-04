import type { GameState, Vec2 } from "../types.ts";
import {
	BULLET_HIT_RADIUS,
	TARGET_X,
	TARGET_Y,
	TARGET_RADIUS,
	ENEMY_RADIUS,
	ENEMY_RUNNER_AGGRO_RANGE,
	ENEMY_MOMENTUM_DECAY,
	WORLD_WIDTH,
	WORLD_HEIGHT,
} from "../config.ts";
import { distance, findNearest, velocityToward } from "./targeting.ts";

const TARGET_POS = { x: TARGET_X, y: TARGET_Y };

export function tickMovement(state: GameState, delta: number): GameState {
	const dt = delta / 1000;

	const enemies = state.enemies.map((e) => {
		const nearRunner = findNearest(e.position, state.runners, (r) => r.position, ENEMY_RUNNER_AGGRO_RANGE);
		const baseVel = velocityToward(
			e.position,
			nearRunner ? nearRunner.position : TARGET_POS,
			e.speed,
		);

		const mf = e.momentumFactor;
		const moveX = baseVel.x * (1 - mf) + e.spawnMomentum.x * mf;
		const moveY = baseVel.y * (1 - mf) + e.spawnMomentum.y * mf;

		return {
			...e,
			velocity: baseVel,
			momentumFactor: Math.max(0, mf - ENEMY_MOMENTUM_DECAY * dt),
			position: { x: e.position.x + moveX * dt, y: e.position.y + moveY * dt },
		};
	});

	const bullets = state.bullets
		.map((b) => ({
			...b,
			position: {
				x: b.position.x + b.velocity.x * dt,
				y: b.position.y + b.velocity.y * dt,
			},
		}))
		.filter(
			(b) =>
				b.position.x > -50 &&
				b.position.x < WORLD_WIDTH + 50 &&
				b.position.y > -50 &&
				b.position.y < WORLD_HEIGHT + 50,
		);

	return { ...state, enemies, bullets };
}

export function tickCombat(
	state: GameState,
): { state: GameState; destroyedEnemyPositions: ReadonlyArray<Vec2> } {
	const destroyedBulletIds = new Set<string>();
	const enemyDamage = new Map<string, number>();
	const regionDamage = new Map<string, number>();

	state.bullets.forEach((bullet) => {
		if (destroyedBulletIds.has(bullet.id)) return;

		state.enemies.forEach((enemy) => {
			if (destroyedBulletIds.has(bullet.id)) return;
			if (distance(bullet.position, enemy.position) < BULLET_HIT_RADIUS) {
				destroyedBulletIds.add(bullet.id);
				enemyDamage.set(enemy.id, (enemyDamage.get(enemy.id) ?? 0) + bullet.damage);
			}
		});

		if (destroyedBulletIds.has(bullet.id)) return;

		state.regions.forEach((region) => {
			if (destroyedBulletIds.has(bullet.id)) return;
			if (distance(bullet.position, region.position) < region.radius) {
				destroyedBulletIds.add(bullet.id);
				regionDamage.set(region.id, (regionDamage.get(region.id) ?? 0) + bullet.damage);
			}
		});
	});

	const destroyedEnemyPositions = state.enemies
		.filter((e) => {
			const dmg = enemyDamage.get(e.id) ?? 0;
			return dmg > 0 && e.hp - dmg <= 0;
		})
		.map((e) => e.position);

	const enemies = state.enemies
		.map((e) => {
			const dmg = enemyDamage.get(e.id) ?? 0;
			if (dmg <= 0) return e;
			const newHp = e.hp - dmg;
			if (newHp <= 0) return null;
			return { ...e, hp: newHp };
		})
		.filter((e): e is NonNullable<typeof e> => e !== null);

	const regions = state.regions
		.map((r) => {
			const dmg = regionDamage.get(r.id) ?? 0;
			if (dmg <= 0) return r;
			const newHp = r.hp - dmg;
			if (newHp <= 0) return null;
			return { ...r, hp: newHp };
		})
		.filter((r): r is NonNullable<typeof r> => r !== null);

	const bullets = state.bullets.filter((b) => !destroyedBulletIds.has(b.id));

	return {
		state: { ...state, enemies, regions, bullets },
		destroyedEnemyPositions,
	};
}

export function tickDefense(state: GameState): GameState {
	const breached = state.enemies.filter(
		(e) => distance(e.position, TARGET_POS) <= TARGET_RADIUS + ENEMY_RADIUS,
	);
	if (breached.length === 0) return state;

	const breachedIds = new Set(breached.map((e) => e.id));
	const totalDamage = breached.reduce((sum, e) => sum + e.hp, 0);

	return {
		...state,
		enemies: state.enemies.filter((e) => !breachedIds.has(e.id)),
		defenseHp: Math.max(0, state.defenseHp - totalDamage),
		gameOver: state.defenseHp - totalDamage <= 0,
	};
}
