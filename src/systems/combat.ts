import type { GameState, DestroyedEntities } from "../types.ts";
import {
	BULLET_HIT_RADIUS,
	TARGET_X,
	TARGET_Y,
	TARGET_RADIUS,
	ENEMY_RADIUS,
	CANVAS_WIDTH,
	CANVAS_HEIGHT,
} from "../config.ts";
import { distance } from "./targeting.ts";

export function tickMovement(state: GameState, delta: number): GameState {
	const dt = delta / 1000;

	const enemies = state.enemies.map((e) => ({
		...e,
		position: { x: e.position.x + e.velocity.x * dt, y: e.position.y + e.velocity.y * dt },
	}));

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
				b.position.x < CANVAS_WIDTH + 50 &&
				b.position.y > -50 &&
				b.position.y < CANVAS_HEIGHT + 50,
		);

	return { ...state, enemies, bullets };
}

export function tickCombat(
	state: GameState,
): { state: GameState; destroyed: DestroyedEntities } {
	const destroyedBulletIds = new Set<string>();
	const enemyDamage = new Map<string, number>();
	const regionDamage = new Map<string, number>();

	state.bullets.forEach((bullet) => {
		if (destroyedBulletIds.has(bullet.id)) return;

		// Check enemies first
		state.enemies.forEach((enemy) => {
			if (destroyedBulletIds.has(bullet.id)) return;
			if (distance(bullet.position, enemy.position) < BULLET_HIT_RADIUS) {
				destroyedBulletIds.add(bullet.id);
				enemyDamage.set(enemy.id, (enemyDamage.get(enemy.id) ?? 0) + bullet.damage);
			}
		});

		if (destroyedBulletIds.has(bullet.id)) return;

		// Then check regions
		state.regions.forEach((region) => {
			if (destroyedBulletIds.has(bullet.id)) return;
			if (distance(bullet.position, region.position) < region.radius) {
				destroyedBulletIds.add(bullet.id);
				regionDamage.set(region.id, (regionDamage.get(region.id) ?? 0) + bullet.damage);
			}
		});
	});

	const destroyedEnemyIds = new Set<string>();
	const enemies = state.enemies
		.map((e) => {
			const dmg = enemyDamage.get(e.id) ?? 0;
			if (dmg <= 0) return e;
			const newHp = e.hp - dmg;
			if (newHp <= 0) {
				destroyedEnemyIds.add(e.id);
				return null;
			}
			return { ...e, hp: newHp };
		})
		.filter((e): e is NonNullable<typeof e> => e !== null);

	const destroyedRegionIds = new Set<string>();
	const regions = state.regions
		.map((r) => {
			const dmg = regionDamage.get(r.id) ?? 0;
			if (dmg <= 0) return r;
			const newHp = r.hp - dmg;
			if (newHp <= 0) {
				destroyedRegionIds.add(r.id);
				return null;
			}
			return { ...r, hp: newHp };
		})
		.filter((r): r is NonNullable<typeof r> => r !== null);

	const bullets = state.bullets.filter((b) => !destroyedBulletIds.has(b.id));

	const destroyedEnemyPositions = state.enemies
		.filter((e) => destroyedEnemyIds.has(e.id))
		.map((e) => e.position);

	return {
		state: { ...state, enemies, regions, bullets },
		destroyed: {
			bulletIds: [...destroyedBulletIds],
			enemyIds: [...destroyedEnemyIds],
			regionIds: [...destroyedRegionIds],
			destroyedEnemyPositions,
		},
	};
}

const TARGET_POS = { x: TARGET_X, y: TARGET_Y };

export function tickDefense(
	state: GameState,
): { state: GameState; breachedIds: ReadonlyArray<string> } {
	const breached = state.enemies.filter(
		(e) => distance(e.position, TARGET_POS) <= TARGET_RADIUS + ENEMY_RADIUS,
	);
	if (breached.length === 0) return { state, breachedIds: [] };

	const breachedIds = new Set(breached.map((e) => e.id));
	const enemies = state.enemies.filter((e) => !breachedIds.has(e.id));
	const newHp = Math.max(0, state.defenseHp - breached.length);

	return {
		state: {
			...state,
			enemies,
			defenseHp: newHp,
			gameOver: newHp <= 0,
		},
		breachedIds: [...breachedIds],
	};
}
