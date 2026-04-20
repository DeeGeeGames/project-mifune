import type { WeaponKind } from '../ships';
import { weaponStats, weaponDisplayName } from '../weaponStats';

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
