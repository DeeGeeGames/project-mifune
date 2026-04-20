import type { WeaponKind, PairSlotId } from './ships';

export const WEAPON_KINDS: readonly WeaponKind[] = ['turret', 'cannon', 'beam', 'missile', 'railgun', 'pd'];

export const WEAPON_LABELS: Record<WeaponKind | 'none', string> = {
	none: 'None',
	turret: 'Turret',
	cannon: 'Cannon',
	beam: 'Beam',
	missile: 'Missile',
	railgun: 'Railgun',
	pd: 'Point Defense',
	mainGun: 'Main Gun',
};

export const WEAPON_LABEL_WIDTH = Math.max(...Object.values(WEAPON_LABELS).map((l) => l.length));

export const PYLON_LABELS: readonly string[] = [
	'Starboard Fore',
	'Starboard Mid',
	'Starboard Aft',
	'Port Fore',
	'Port Mid',
	'Port Aft',
];

export const PAIR_LABELS: Record<PairSlotId, string> = {
	forePair:     'Fore Pair',
	aftPair:      'Aft Pair',
	stbdForeSide: 'Starboard Fore-Side',
	stbdSideAft:  'Starboard Side-Aft',
	portForeSide: 'Port Fore-Side',
	portSideAft:  'Port Side-Aft',
};
