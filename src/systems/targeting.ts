import type { Vec2, Enemy } from "../types.ts";
import { TURRET_RANGE } from "../config.ts";

export function distance(a: Vec2, b: Vec2): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

export function velocityToward(from: Vec2, to: Vec2, speed: number): Vec2 {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const mag = Math.sqrt(dx * dx + dy * dy);
	if (mag < 1) return { x: 0, y: 0 };
	return { x: (dx / mag) * speed, y: (dy / mag) * speed };
}

export function findNearest<T>(
	from: Vec2,
	items: ReadonlyArray<T>,
	getPos: (item: T) => Vec2,
	maxRange?: number,
): T | null {
	const candidates = maxRange !== undefined
		? items.filter((item) => distance(from, getPos(item)) <= maxRange)
		: items;

	if (candidates.length === 0) return null;

	return candidates.reduce((best, item) => {
		const bestDist = distance(from, getPos(best));
		const itemDist = distance(from, getPos(item));
		return itemDist < bestDist ? item : best;
	});
}

export function findNearestEnemy(
	from: Vec2,
	enemies: ReadonlyArray<Enemy>,
): Enemy | null {
	return findNearest(from, enemies, (e) => e.position, TURRET_RANGE);
}

export function aimAngle(from: Vec2, to: Vec2): number {
	return Math.atan2(to.y - from.y, to.x - from.x);
}

export function leadTarget(
	from: Vec2,
	enemy: Enemy,
	bulletSpeed: number,
): Vec2 {
	const ex = enemy.velocity.x;
	const ey = enemy.velocity.y;
	const dx = enemy.position.x - from.x;
	const dy = enemy.position.y - from.y;

	const a = ex * ex + ey * ey - bulletSpeed * bulletSpeed;
	const b = 2 * (dx * ex + dy * ey);
	const c = dx * dx + dy * dy;
	const discriminant = b * b - 4 * a * c;

	if (discriminant < 0) return enemy.position;

	const sqrtD = Math.sqrt(discriminant);
	const t1 = (-b - sqrtD) / (2 * a);
	const t2 = (-b + sqrtD) / (2 * a);
	const t = t1 > 0 ? t1 : t2 > 0 ? t2 : 0;

	return {
		x: enemy.position.x + ex * t,
		y: enemy.position.y + ey * t,
	};
}

export function computeBulletVelocity(
	from: Vec2,
	to: Vec2,
	speed: number,
): Vec2 {
	const angle = aimAngle(from, to);
	return {
		x: Math.cos(angle) * speed,
		y: Math.sin(angle) * speed,
	};
}
