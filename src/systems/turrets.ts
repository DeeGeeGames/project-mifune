import type { Bullet, GameState, Turret, Vec2 } from "../types.ts";
import {
	BULLET_DAMAGE,
	BULLET_SPEED,
	TURRET_FIRE_RATE,
	TURRET_RANGE,
	TURRET_SPREAD,
	TURRET_TURN_SPEED,
	PLACEMENT_MAX_X,
	PLACEMENT_MIN_X,
	TURRET_RADIUS,
	GROUND_Y,
} from "../config.ts";
import { makeId } from "../state.ts";
import {
	findNearestEnemy,
	leadTarget,
	aimAngle,
	computeBulletVelocity,
	distance,
} from "./targeting.ts";

function rotateToward(current: number, target: number, maxDelta: number): number {
	let diff = target - current;
	// Normalize to [-π, π]
	while (diff > Math.PI) diff -= Math.PI * 2;
	while (diff < -Math.PI) diff += Math.PI * 2;
	return current + Math.max(-maxDelta, Math.min(maxDelta, diff));
}

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
	time: number,
): { turret: Turret; bullet: Bullet } | null {
	const cooldown = 1000 / TURRET_FIRE_RATE;
	if (time - turret.lastFiredAt < cooldown) return null;

	const velocity = addSpread(
		computeBulletVelocity(turret.position, {
			x: turret.position.x + Math.cos(turret.aimAngle),
			y: turret.position.y + Math.sin(turret.aimAngle),
		}, BULLET_SPEED),
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
	delta: number,
): { state: GameState; bullets: ReadonlyArray<Bullet> } {
	const newBullets: Bullet[] = [];
	const control = state.controlMode;
	const maxRotation = TURRET_TURN_SPEED * (delta / 1000);

	const updatedTurrets = state.turrets.map((turret) => {
		const isControlled =
			control.tag === "all" ||
			(control.tag === "single" && control.turretId === turret.id);

		const targetAngle = isControlled
			? aimAngle(turret.position, pointerPosition)
			: (() => {
					const enemy = findNearestEnemy(turret, state.enemies);
					if (!enemy) return turret.aimAngle;
					return aimAngle(turret.position, leadTarget(turret.position, enemy, BULLET_SPEED));
				})();

		const newAimAngle = rotateToward(turret.aimAngle, targetAngle, maxRotation);
		const rotated = { ...turret, aimAngle: newAimAngle };

		if (isControlled && pointerDown) {
			const result = tryFire(rotated, time);
			if (result) {
				newBullets.push(result.bullet);
				return result.turret;
			}
			return rotated;
		}

		if (!isControlled) {
			const target = findNearestEnemy(turret, state.enemies);
			if (target) {
				const result = tryFire(rotated, time);
				if (result) {
					newBullets.push(result.bullet);
					return result.turret;
				}
			}
		}

		return rotated;
	});

	return {
		state: { ...state, turrets: updatedTurrets },
		bullets: newBullets,
	};
}

export function isValidPlacement(position: Vec2, turrets: ReadonlyArray<Turret>): boolean {
	if (position.x < PLACEMENT_MIN_X || position.x > PLACEMENT_MAX_X) return false;

	const snapped = { x: position.x, y: GROUND_Y };
	return turrets.every(
		(t) => distance(t.position, snapped) > TURRET_RADIUS * 2.5,
	);
}

export function createTurret(position: Vec2): Turret {
	return {
		id: makeId(),
		position: { x: position.x, y: GROUND_Y },
		range: TURRET_RANGE,
		fireRate: TURRET_FIRE_RATE,
		lastFiredAt: 0,
		aimAngle: -Math.PI / 2, // start pointing up
	};
}
