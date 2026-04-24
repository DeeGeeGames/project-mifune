export interface ColliderComponent {
	readonly halfLength: number;
	readonly radius: number;
	readonly mass: number;
	readonly invMass: number;
	readonly invInertia: number;
}

export interface ColliderSpec {
	readonly hullLength: number;
	readonly hullWidth: number;
	readonly hullHeight: number;
	readonly colliderLength?: number;
	readonly colliderWidth?: number;
	readonly massScale?: number;
}

export const makeCollider = (spec: ColliderSpec): ColliderComponent => {
	const cLen = spec.colliderLength ?? spec.hullLength;
	const cWid = spec.colliderWidth ?? spec.hullWidth;
	const halfLength = Math.max(0, (cLen - cWid) / 2);
	const radius = cWid / 2;
	const massScale = spec.massScale ?? 1;
	const mass = spec.hullLength * spec.hullWidth * spec.hullHeight * massScale;
	const invMass = mass > 0 ? 1 / mass : 0;
	const inertia = (mass * (spec.hullLength * spec.hullLength + spec.hullWidth * spec.hullWidth)) / 12;
	const invInertia = inertia > 0 ? 1 / inertia : 0;
	return { halfLength, radius, mass, invMass, invInertia };
};
