import type { World } from './types';
import { pylonsConsumedByPairs, type WeaponKind } from './ships';
import {
	WEAPON_COSTS,
	REROLL_BASE_COST,
	REROLL_PER_WAVE,
	REROLL_PER_REROLL,
} from './constants';
import { WEAPON_KINDS, WEAPON_LABELS } from './loadoutLabels';

export type Rng = () => number;

export type ShopItemPayload =
	| { readonly kind: 'weapon'; readonly weaponKind: WeaponKind };

export interface ShopOffer {
	readonly payload: ShopItemPayload;
	readonly cost: number;
	sold: boolean;
}

export type PurchaseFollowUp =
	| { readonly status: 'complete' }
	| { readonly status: 'needsAssignment'; readonly assignment: 'pylon' };

interface ShopItemHandler<P extends ShopItemPayload> {
	readonly label: (payload: P) => string;
	readonly baseCost: (payload: P) => number;
	readonly canOffer: (world: World) => boolean;
	readonly canPurchase: (payload: P, world: World) => boolean;
	readonly rollOne: (rng: Rng, excluded: ReadonlySet<string>) => P | null;
	readonly identity: (payload: P) => string;
	readonly onPurchase: (world: World, payload: P) => PurchaseFollowUp;
	readonly weight: number;
}

type HandlerMap = {
	readonly [K in ShopItemPayload['kind']]: ShopItemHandler<Extract<ShopItemPayload, { kind: K }>>;
};

const hasEmptyPylon = (world: World): boolean => {
	const loadout = world.getResource('carrierLoadout');
	const consumed = pylonsConsumedByPairs(loadout);
	return loadout.pylons.some((p, idx) => p.weaponKind === null && !consumed.has(idx));
};

const pickRandom = <T>(rng: Rng, items: readonly T[]): T | null => {
	if (items.length === 0) return null;
	const idx = Math.min(items.length - 1, Math.floor(rng() * items.length));
	return items[idx] ?? null;
};

const weaponHandler: ShopItemHandler<{ kind: 'weapon'; weaponKind: WeaponKind }> = {
	label: (payload) => WEAPON_LABELS[payload.weaponKind],
	baseCost: (payload) => WEAPON_COSTS[payload.weaponKind],
	canOffer: () => true,
	canPurchase: (_payload, world) => hasEmptyPylon(world),
	rollOne: (rng, excluded) => {
		const available = WEAPON_KINDS.filter((k) => !excluded.has(`weapon:${k}`));
		const chosen = pickRandom(rng, available);
		return chosen === null ? null : { kind: 'weapon', weaponKind: chosen };
	},
	identity: (payload) => `weapon:${payload.weaponKind}`,
	onPurchase: () => ({ status: 'needsAssignment', assignment: 'pylon' }),
	weight: 1,
};

export const SHOP_ITEM_HANDLERS: HandlerMap = {
	weapon: weaponHandler,
};

// HandlerMap narrows by kind but TS can't always reduce Extract<...> through a
// generic param, so indexing through the union-widened type keeps the call sites
// free of per-kind casts.
type AnyHandler = ShopItemHandler<ShopItemPayload>;

const handlerFor = (payload: ShopItemPayload): AnyHandler =>
	SHOP_ITEM_HANDLERS[payload.kind] as AnyHandler;

export const offerLabel = (offer: ShopOffer): string => handlerFor(offer.payload).label(offer.payload);

export const offerCanPurchase = (offer: ShopOffer, world: World): boolean =>
	handlerFor(offer.payload).canPurchase(offer.payload, world);

export const offerOnPurchase = (offer: ShopOffer, world: World): PurchaseFollowUp =>
	handlerFor(offer.payload).onPurchase(world, offer.payload);

const HANDLER_KINDS = Object.keys(SHOP_ITEM_HANDLERS) as readonly ShopItemPayload['kind'][];

const pickWeightedKind = (rng: Rng, world: World): ShopItemPayload['kind'] | null => {
	const kinds = HANDLER_KINDS.filter((k) => SHOP_ITEM_HANDLERS[k].canOffer(world));
	if (kinds.length === 0) return null;
	const total = kinds.reduce((sum, k) => sum + SHOP_ITEM_HANDLERS[k].weight, 0);
	if (total <= 0) return null;
	const roll = rng() * total;
	return kinds.reduce<{ acc: number; chosen: ShopItemPayload['kind'] | null }>(
		(state, k) => {
			if (state.chosen !== null) return state;
			const nextAcc = state.acc + SHOP_ITEM_HANDLERS[k].weight;
			return nextAcc >= roll ? { acc: nextAcc, chosen: k } : { acc: nextAcc, chosen: null };
		},
		{ acc: 0, chosen: null },
	).chosen;
};

const rollOne = (rng: Rng, world: World, excluded: ReadonlySet<string>): ShopOffer | null => {
	const kind = pickWeightedKind(rng, world);
	if (kind === null) return null;
	const handler = SHOP_ITEM_HANDLERS[kind] as AnyHandler;
	const payload = handler.rollOne(rng, excluded);
	if (payload === null) return null;
	return { payload, cost: handler.baseCost(payload), sold: false };
};

export const rollOffers = (world: World, count: number, rng: Rng): ShopOffer[] =>
	Array.from({ length: count }).reduce<{ offers: ShopOffer[]; excluded: Set<string> }>(
		(state) => {
			const offer = rollOne(rng, world, state.excluded);
			if (offer === null) return state;
			const id = handlerFor(offer.payload).identity(offer.payload);
			state.excluded.add(id);
			return { offers: [...state.offers, offer], excluded: state.excluded };
		},
		{ offers: [], excluded: new Set<string>() },
	).offers;

export const rerollCost = (waveNumber: number, rerollCount: number): number =>
	REROLL_BASE_COST + REROLL_PER_WAVE * waveNumber + REROLL_PER_REROLL * rerollCount;
