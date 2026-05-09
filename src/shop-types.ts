import type { WeaponKind } from './ships';

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
