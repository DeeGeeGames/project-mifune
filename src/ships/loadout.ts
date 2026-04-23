import { FRONT, STARBOARD_FORE, STARBOARD_AFT } from './angles';

export type PylonCategory = 'forward' | 'side' | 'back';

export type WeaponKind = 'turret' | 'cannon' | 'beam' | 'missile' | 'railgun' | 'pd' | 'mainGun';

export type AuxiliaryKind = 'shield';

export interface AuxiliaryMount {
	readonly x: number;
	readonly z: number;
}

export interface EmptyTurretMount {
	readonly x: number;
	readonly z: number;
	readonly baseAngle: number;
	readonly category: PylonCategory;
}

export interface CarrierLoadoutAux {
	systemKind: AuxiliaryKind | null;
}

export interface CarrierLoadoutPylon {
	weaponKind: WeaponKind | null;
	facing: number;
}

export type PairSlotId =
	| 'forePair'
	| 'aftPair'
	| 'stbdForeSide'
	| 'stbdSideAft'
	| 'portForeSide'
	| 'portSideAft';

export interface PairSlotDef {
	readonly slot: PairSlotId;
	readonly pylonA: number;
	readonly pylonB: number;
}

export interface CarrierLoadoutPair {
	readonly slot: PairSlotId;
	readonly pylonA: number;
	readonly pylonB: number;
	weaponKind: 'mainGun' | null;
}

export interface CarrierLoadout {
	pylons: CarrierLoadoutPylon[];
	pairs: CarrierLoadoutPair[];
	auxSlots: CarrierLoadoutAux[];
}

export const PAIR_SLOTS: readonly PairSlotDef[] = [
	{ slot: 'forePair',     pylonA: 0, pylonB: 3 },
	{ slot: 'aftPair',      pylonA: 2, pylonB: 5 },
	{ slot: 'stbdForeSide', pylonA: 0, pylonB: 1 },
	{ slot: 'stbdSideAft',  pylonA: 1, pylonB: 2 },
	{ slot: 'portForeSide', pylonA: 3, pylonB: 4 },
	{ slot: 'portSideAft',  pylonA: 4, pylonB: 5 },
];

const PYLON_ARC_RANGES = {
	forward: [FRONT, STARBOARD_AFT],
	side: [STARBOARD_FORE, STARBOARD_AFT],
	back: [STARBOARD_FORE, Math.PI],
} as const;

export function pylonArc(mount: EmptyTurretMount): { readonly min: number; readonly max: number } {
	const [lo, hi] = PYLON_ARC_RANGES[mount.category];
	return mount.x >= 0 ? { min: lo, max: hi } : { min: -hi, max: -lo };
}

export const pylonsConsumedByPairs = (loadout: CarrierLoadout): ReadonlySet<number> => {
	const consumed = new Set<number>();
	loadout.pairs.forEach((p) => {
		if (p.weaponKind === 'mainGun') {
			consumed.add(p.pylonA);
			consumed.add(p.pylonB);
		}
	});
	return consumed;
};
