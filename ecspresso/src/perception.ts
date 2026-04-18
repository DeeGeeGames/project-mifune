import type { KinematicState, KinematicTransform } from './kinematic';

export type PerceptionTier = 'positional' | 'kinematic' | 'predictive';

export type PlayerSnapshot =
	| { readonly tier: 'positional'; readonly x: number; readonly z: number }
	| {
			readonly tier: 'kinematic';
			readonly x: number;
			readonly z: number;
			readonly vx: number;
			readonly vz: number;
	  }
	| {
			readonly tier: 'predictive';
			readonly x: number;
			readonly z: number;
			readonly vx: number;
			readonly vz: number;
			readonly heading: number;
			readonly turnSpeed: number;
			readonly throttle: number;
	  };

export function getPlayerSnapshot(
	ship: KinematicState,
	transform: KinematicTransform,
	tier: PerceptionTier,
): PlayerSnapshot {
	if (tier === 'positional') {
		return { tier, x: transform.x, z: transform.z };
	}
	if (tier === 'kinematic') {
		return { tier, x: transform.x, z: transform.z, vx: ship.vx, vz: ship.vz };
	}
	return {
		tier: 'predictive',
		x: transform.x,
		z: transform.z,
		vx: ship.vx,
		vz: ship.vz,
		heading: ship.heading,
		turnSpeed: ship.turnSpeed,
		throttle: ship.throttle,
	};
}
