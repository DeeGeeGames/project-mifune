import type { Bullet, GameState, Turret, Vec2 } from "../types.ts";
import {
	BULLET_DAMAGE,
	BULLET_SPEED,
	TURRET_FIRE_RATE,
	TURRET_RANGE,
	TURRET_SPREAD,
	PLACEMENT_MAX_X,
	PLACEMENT_MIN_X,
	PLACEMENT_MIN_Y,
	PLACEMENT_MAX_Y,
	TURRET_RADIUS,
} from "../config.ts";
import { makeId } from "../state.ts";
import {
	findNearestEnemy,
	leadTarget,
	computeBulletVelocity,
	distance,
} from "./targeting.ts";

function addSpread(velocity: Vec2): Vec2 {
	const angle = Math.atan2(velocity.y, velocity.x);
	const spread = (Math.random() - 0.5) * TURRET_SPREAD * 2;
	const newAngle = angle + spread;
	const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
	return {
		x: Math.cos(newAngle) * speed,
		y: Math.sin(newAngle) * speed,
	};
}

function tryFire(
	turret: Turret,
	target: Vec2,
	time: number,
): { turret: Turret; bullet: Bullet } | null {
	const cooldown = 1000 / TURRET_FIRE_RATE;
	if (time - turret.lastFiredAt < cooldown) return null;

	const velocity = addSpread(
		computeBulletVelocity(turret.position, target, BULLET_SPEED),
	);
	const bullet: Bullet = {
		id: makeId(),
		position: { ...turret.position },
		velocity,
		damage: BULLET_DAMAGE,
	};

	return {
		turret: { ...turret, lastFiredAt: time },
		bullet,
	};
}

export function tickTurrets(
	state: GameState,
	pointerPosition: Vec2,
	pointerDown: boolean,
	time: number,
): { state: GameState; bullets: ReadonlyArray<Bullet> } {
	const newBullets: Bullet[] = [];
	const control = state.controlMode;

	const updatedTurrets = state.turrets.map((turret) => {
		const isControlled =
			control.tag === "all" ||
			(control.tag === "single" && control.turretId === turret.id);

		if (isControlled && pointerDown) {
			const result = tryFire(turret, pointerPosition, time);
			if (result) {
				newBullets.push(result.bullet);
				return result.turret;
			}
			return turret;
		}

		if (!isControlled) {
			const target = findNearestEnemy(turret, state.enemies);
			if (target) {
				const aimPoint = leadTarget(turret.position, target, BULLET_SPEED);
				const result = tryFire(turret, aimPoint, time);
				if (result) {
					newBullets.push(result.bullet);
					return result.turret;
				}
			}
		}

		return turret;
	});

	return {
		state: { ...state, turrets: updatedTurrets },
		bullets: newBullets,
	};
}

export function isValidPlacement(position: Vec2, turrets: ReadonlyArray<Turret>): boolean {
	if (position.x < PLACEMENT_MIN_X || position.x > PLACEMENT_MAX_X) return false;
	if (position.y < PLACEMENT_MIN_Y || position.y > PLACEMENT_MAX_Y) return false;

	return turrets.every(
		(t) => distance(t.position, position) > TURRET_RADIUS * 2.5,
	);
}

export function createTurret(position: Vec2): Turret {
	return {
		id: makeId(),
		position,
		range: TURRET_RANGE,
		fireRate: TURRET_FIRE_RATE,
		lastFiredAt: 0,
	};
}
