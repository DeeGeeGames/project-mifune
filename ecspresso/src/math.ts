export type Vec2 = { readonly x: number; readonly z: number };

export function normalizeAngle(angle: number): number {
	const a = angle % (2 * Math.PI);
	return a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a;
}

export function angleDiff(target: number, current: number): number {
	return normalizeAngle(target - current);
}

export function stepAngle(current: number, target: number, maxStep: number): number {
	const diff = angleDiff(target, current);
	const clamped = Math.max(-maxStep, Math.min(maxStep, diff));
	return normalizeAngle(current + clamped);
}

export function rotateY(v: Vec2, angle: number): Vec2 {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return { x: v.x * c - v.z * s, z: v.x * s + v.z * c };
}

export function distanceXZ(ax: number, az: number, bx: number, bz: number): number {
	const dx = ax - bx;
	const dz = az - bz;
	return Math.sqrt(dx * dx + dz * dz);
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function degreesRounded(rad: number): number {
	return Math.round((rad * 180) / Math.PI);
}

export type LeadResult = { readonly x: number; readonly z: number };

export function leadTarget(
	shooterX: number,
	shooterZ: number,
	targetX: number,
	targetZ: number,
	targetVx: number,
	targetVz: number,
	bulletSpeed: number,
): LeadResult {
	const dx = targetX - shooterX;
	const dz = targetZ - shooterZ;

	const a = targetVx * targetVx + targetVz * targetVz - bulletSpeed * bulletSpeed;
	const b = 2 * (dx * targetVx + dz * targetVz);
	const c = dx * dx + dz * dz;
	const discriminant = b * b - 4 * a * c;

	if (discriminant < 0) return { x: targetX, z: targetZ };

	const sqrtD = Math.sqrt(discriminant);
	const t1 = (-b - sqrtD) / (2 * a);
	const t2 = (-b + sqrtD) / (2 * a);
	const t = t1 > 0 ? t1 : t2 > 0 ? t2 : 0;

	return { x: targetX + targetVx * t, z: targetZ + targetVz * t };
}

export function bearingXZ(fromX: number, fromZ: number, toX: number, toZ: number): number {
	return Math.atan2(toX - fromX, toZ - fromZ);
}

export function forwardXZ(heading: number): Vec2 {
	return { x: Math.sin(heading), z: Math.cos(heading) };
}

export function mountToWorld(
	shipX: number,
	shipZ: number,
	shipHeading: number,
	mountX: number,
	mountZ: number,
): Vec2 {
	const rotated = rotateY({ x: mountX, z: mountZ }, shipHeading);
	return { x: shipX + rotated.x, z: shipZ + rotated.z };
}

export function stickToWorldAngle(
	sx: number,
	sy: number,
	threshold: number,
	azimuth: number,
): number | null {
	const mag = Math.sqrt(sx * sx + sy * sy);
	if (mag < threshold) return null;
	const world = rotateY({ x: sx, z: sy }, -azimuth);
	return Math.atan2(world.x, world.z);
}
