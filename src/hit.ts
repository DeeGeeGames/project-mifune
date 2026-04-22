export const segmentHitDistance = (
	originX: number,
	originZ: number,
	dirX: number,
	dirZ: number,
	range: number,
	targetX: number,
	targetZ: number,
	targetRadius: number,
	beamRadius: number,
): number => {
	const rx = targetX - originX;
	const rz = targetZ - originZ;
	const t = rx * dirX + rz * dirZ;
	if (t < 0 || t > range) return Infinity;
	const px = rx - dirX * t;
	const pz = rz - dirZ * t;
	const reach = targetRadius + beamRadius;
	return px * px + pz * pz <= reach * reach ? t : Infinity;
};
