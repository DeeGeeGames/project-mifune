import type { ArcRange, Bullet, EntityId, GameState, Turret, Vec2 } from "../types.ts";
import {
	BULLET_DAMAGE,
	BULLET_SPEED,
	TURRET_FIRE_RATE,
	TURRET_SPREAD,
	TURRET_TURN_SPEED,
	TURRET_MAX_AMMO,
	PLACEMENT_MAX_X,
	PLACEMENT_MIN_X,
	TURRET_RADIUS,
	GROUND_Y,
} from "../config.ts";
import { makeId } from "../state.ts";
import {
	findNearestEnemyInArc,
	leadTarget,
	aimAngle,
	computeBulletVelocity,
	distance,
	normalizeAngleDiff,
} from "./targeting.ts";

function rotateToward(current: number, target: number, maxDelta: number): number {
	const diff = normalizeAngleDiff(target, current);
	return current + Math.max(-maxDelta, Math.min(maxDelta, diff));
}

function addSpread(velocity: Vec2): Vec2 {
	const angle = Math.atan2(velocity.y, velocity.x);
	const newAngle = angle + (Math.random() - 0.5) * TURRET_SPREAD * 2;
	const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
	return {
		x: Math.cos(newAngle) * speed,
		y: Math.sin(newAngle) * speed,
	};
}

function clampAngleToArc(angle: number, arcCenter: number, arcWidth: number): number {
	const diff = normalizeAngleDiff(angle, arcCenter);
	const halfArc = arcWidth / 2;
	if (Math.abs(diff) <= halfArc) return angle;
	return arcCenter + (diff > 0 ? halfArc : -halfArc);
}

function tryFire(
	turret: Turret,
	time: number,
): { turret: Turret; bullet: Bullet } | null {
	if (turret.ammo <= 0) return null;
	const cooldown = 1000 / TURRET_FIRE_RATE;
	if (time - turret.lastFiredAt < cooldown) return null;

	const velocity = addSpread(
		computeBulletVelocity(turret.position, {
			x: turret.position.x + Math.cos(turret.aimAngle),
			y: turret.position.y + Math.sin(turret.aimAngle),
		}, BULLET_SPEED),
	);

	return {
		turret: { ...turret, lastFiredAt: time, ammo: turret.ammo - 1 },
		bullet: {
			id: makeId(),
			position: { ...turret.position },
			velocity,
			damage: BULLET_DAMAGE,
		},
	};
}

function tickSingleTurret(
	turret: Turret,
	isControlled: boolean,
	pointerPosition: Vec2,
	pointerDown: boolean,
	nearestEnemy: ReturnType<typeof findNearestEnemyInArc>,
	time: number,
	maxRotation: number,
): { turret: Turret; bullet: Bullet | null } {
	const targetAngle = isControlled
		? aimAngle(turret.position, pointerPosition)
		: nearestEnemy
			? clampAngleToArc(
				aimAngle(turret.position, leadTarget(turret.position, nearestEnemy, BULLET_SPEED)),
				turret.arcCenter,
				turret.arcWidth,
			)
			: turret.arcCenter;

	const rotated = { ...turret, aimAngle: rotateToward(turret.aimAngle, targetAngle, maxRotation) };

	const shouldFire = isControlled ? pointerDown : nearestEnemy !== null;
	if (!shouldFire) return { turret: rotated, bullet: null };

	const result = tryFire(rotated, time);
	if (!result) return { turret: rotated, bullet: null };

	return { turret: result.turret, bullet: result.bullet };
}

export function tickTurrets(
	state: GameState,
	pointerPosition: Vec2,
	pointerDown: boolean,
	time: number,
	delta: number,
): GameState {
	const control = state.controlMode;
	const maxRotation = TURRET_TURN_SPEED * (delta / 1000);

	const results = state.turrets.map((turret) => {
		const isControlled =
			control.tag === "all" ||
			(control.tag === "single" && control.turretId === turret.id);

		const nearestEnemy = isControlled ? null : findNearestEnemyInArc(turret.position, state.enemies, turret.arcCenter, turret.arcWidth);

		return tickSingleTurret(turret, isControlled, pointerPosition, pointerDown, nearestEnemy, time, maxRotation);
	});

	return {
		...state,
		turrets: results.map((r) => r.turret),
		bullets: [
			...state.bullets,
			...results.map((r) => r.bullet).filter((b): b is Bullet => b !== null),
		],
	};
}

export function isValidPlacement(position: Vec2, turrets: ReadonlyArray<Turret>): boolean {
	if (position.x < PLACEMENT_MIN_X || position.x > PLACEMENT_MAX_X) return false;

	const snapped = { x: position.x, y: GROUND_Y };
	return turrets.every(
		(t) => distance(t.position, snapped) > TURRET_RADIUS * 2.5,
	);
}

export function createTurret(
	position: Vec2,
	arcCenter: number,
	arcWidth: number,
	arcRange: ArcRange,
	parentBlockId: EntityId | null = null,
): Turret {
	return {
		id: makeId(),
		position: parentBlockId ? position : { x: position.x, y: GROUND_Y },
		lastFiredAt: 0,
		aimAngle: arcCenter,
		ammo: TURRET_MAX_AMMO,
		arcCenter,
		arcWidth,
		arcRange,
		parentBlockId,
	};
}
