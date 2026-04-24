import type { WeaponKind, AuxiliaryKind } from '../ships';
import { weaponStats, weaponDisplayName } from '../weaponStats';
import { AUXILIARY_LABELS } from '../loadoutLabels';
import {
	HANGAR_CAPACITY,
	HANGAR_ENGAGE_RADIUS,
	HANGAR_LAUNCH_INTERVAL_SEC,
	HANGAR_MANUFACTURE_SEC,
	SHIELD_DEPLETED_DELAY_SEC,
	SHIELD_HP_PER_GENERATOR,
	SHIELD_REGEN_PER_GENERATOR_PER_SEC,
} from '../constants';

export const buildLabeledRow = (rowClass: string, label: string, value: string): HTMLElement => {
	const row = document.createElement('div');
	row.className = rowClass;
	const labelEl = document.createElement('span');
	labelEl.className = 'label';
	labelEl.textContent = label;
	const valueEl = document.createElement('span');
	valueEl.className = 'value';
	valueEl.textContent = value;
	row.append(labelEl, valueEl);
	return row;
};

const buildSingle = (className: string, text: string): HTMLElement => {
	const el = document.createElement('div');
	el.className = className;
	el.textContent = text;
	return el;
};

export const renderStatCard = (
	el: HTMLElement,
	kind: WeaponKind | null,
	emptyMessage: string = '— no weapon selected —',
): void => {
	if (kind === null) {
		el.replaceChildren(
			buildSingle('stat-card-title', 'Empty Pylon'),
			buildSingle('stat-card-empty', emptyMessage),
		);
		return;
	}
	const rows = weaponStats(kind).map(({ label, value }) => buildLabeledRow('stat-card-row', label, value));
	el.replaceChildren(buildSingle('stat-card-title', weaponDisplayName(kind)), ...rows);
};

const auxStats = (kind: AuxiliaryKind): readonly { label: string; value: string }[] => {
	if (kind === 'shield') {
		return [
			{ label: 'Max (per gen)', value: `${SHIELD_HP_PER_GENERATOR}` },
			{ label: 'Regen (per gen)', value: `${SHIELD_REGEN_PER_GENERATOR_PER_SEC}/s` },
			{ label: 'Depleted lockout', value: `${SHIELD_DEPLETED_DELAY_SEC}s` },
		];
	}
	if (kind === 'hangar') {
		return [
			{ label: 'Capacity', value: `${HANGAR_CAPACITY}` },
			{ label: 'Launch interval', value: `${HANGAR_LAUNCH_INTERVAL_SEC}s` },
			{ label: 'Manufacture', value: `${HANGAR_MANUFACTURE_SEC}s` },
			{ label: 'Engage radius', value: `${HANGAR_ENGAGE_RADIUS}` },
		];
	}
	return [];
};

export const renderAuxStatCard = (el: HTMLElement, kind: AuxiliaryKind | null): void => {
	if (kind === null) {
		el.replaceChildren(
			buildSingle('stat-card-title', 'Empty Aux Slot'),
			buildSingle('stat-card-empty', '— no system installed —'),
		);
		return;
	}
	const rows = auxStats(kind).map(({ label, value }) => buildLabeledRow('stat-card-row', label, value));
	el.replaceChildren(buildSingle('stat-card-title', AUXILIARY_LABELS[kind]), ...rows);
};
