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

export type SegmentClosest = {
	readonly ax: number;
	readonly az: number;
	readonly bx: number;
	readonly bz: number;
};

export function closestPointsOnSegments2D(
	a1x: number, a1z: number, a2x: number, a2z: number,
	b1x: number, b1z: number, b2x: number, b2z: number,
): SegmentClosest {
	const dax = a2x - a1x;
	const daz = a2z - a1z;
	const dbx = b2x - b1x;
	const dbz = b2z - b1z;
	const rx = a1x - b1x;
	const rz = a1z - b1z;
	const a = dax * dax + daz * daz;
	const e = dbx * dbx + dbz * dbz;
	const f = dbx * rx + dbz * rz;
	const EPS = 1e-8;

	const pickEndpoints = (): SegmentClosest => {
		if (a <= EPS && e <= EPS) return { ax: a1x, az: a1z, bx: b1x, bz: b1z };
		if (a <= EPS) {
			const tt = clamp(f / e, 0, 1);
			return { ax: a1x, az: a1z, bx: b1x + dbx * tt, bz: b1z + dbz * tt };
		}
		const c = dax * rx + daz * rz;
		const ss = clamp(-c / a, 0, 1);
		return { ax: a1x + dax * ss, az: a1z + daz * ss, bx: b1x, bz: b1z };
	};

	if (a <= EPS || e <= EPS) return pickEndpoints();

	const c = dax * rx + daz * rz;
	const b = dax * dbx + daz * dbz;
	const denom = a * e - b * b;
	const sInit = denom !== 0 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
	const tInit = (b * sInit + f) / e;
	const tClamped = clamp(tInit, 0, 1);
	const sFinal = clamp((b * tClamped - c) / a, 0, 1);

	return {
		ax: a1x + dax * sFinal,
		az: a1z + daz * sFinal,
		bx: b1x + dbx * tClamped,
		bz: b1z + dbz * tClamped,
	};
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function pointCapsuleDistanceSqXZ(
	px: number, pz: number,
	cx: number, cz: number,
	heading: number,
	halfLength: number,
): number {
	const fx = Math.sin(heading);
	const fz = Math.cos(heading);
	const rx = px - cx;
	const rz = pz - cz;
	const t = clamp(rx * fx + rz * fz, -halfLength, halfLength);
	const qx = rx - fx * t;
	const qz = rz - fz * t;
	return qx * qx + qz * qz;
}

export function segmentCapsuleDistanceSqXZ(
	originX: number, originZ: number,
	dirX: number, dirZ: number,
	range: number,
	cx: number, cz: number,
	heading: number,
	halfLength: number,
): { readonly distanceSq: number; readonly t: number } {
	const fx = Math.sin(heading);
	const fz = Math.cos(heading);
	const a1x = cx - fx * halfLength;
	const a1z = cz - fz * halfLength;
	const a2x = cx + fx * halfLength;
	const a2z = cz + fz * halfLength;
	const b2x = originX + dirX * range;
	const b2z = originZ + dirZ * range;
	const cp = closestPointsOnSegments2D(a1x, a1z, a2x, a2z, originX, originZ, b2x, b2z);
	const dx = cp.bx - cp.ax;
	const dz = cp.bz - cp.az;
	const t = (cp.bx - originX) * dirX + (cp.bz - originZ) * dirZ;
	return { distanceSq: dx * dx + dz * dz, t };
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
