import type { Vec2, Enemy, Turret } from "../types.ts";

export function distance(a: Vec2, b: Vec2): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

export function findNearestEnemy(
	turret: Turret,
	enemies: ReadonlyArray<Enemy>,
): Enemy | null {
	const inRange = enemies.filter(
		(e) => distance(turret.position, e.position) <= turret.range,
	);

	if (inRange.length === 0) return null;

	return inRange.reduce((closest, enemy) =>
		distance(turret.position, enemy.position) <
		distance(turret.position, closest.position)
			? enemy
			: closest,
	);
}

export function aimAngle(from: Vec2, to: Vec2): number {
	return Math.atan2(to.y - from.y, to.x - from.x);
}

export function leadTarget(
	from: Vec2,
	enemy: Enemy,
	bulletSpeed: number,
): Vec2 {
	// Enemy velocity is purely leftward
	const ex = -enemy.speed;
	const ey = 0;
	const dx = enemy.position.x - from.x;
	const dy = enemy.position.y - from.y;

	// Solve quadratic for time-to-intercept:
	// |enemyPos + enemyVel*t - from|² = (bulletSpeed*t)²
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
