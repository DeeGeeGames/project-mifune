import type { InputResourceTypes } from 'ecspresso/plugins/input/input';
import type { GameAction } from './types';

type InputState = InputResourceTypes<GameAction>['inputState'];
type Axis = 1 | -1 | 0;

export const wrapIndex = (i: number, n: number): number => (i + n) % n;

export const menuAxisDelta = (
	inputState: InputState,
	negAction: GameAction,
	posAction: GameAction,
): Axis => {
	const pos = inputState.actions.justActivated(posAction);
	const neg = inputState.actions.justActivated(negAction);
	return pos && !neg ? 1 : neg && !pos ? -1 : 0;
};

export const menuCursor = (selected: boolean): string => (selected ? '▶ ' : '  ');

export const renderMenuText = <T>(
	items: readonly T[],
	selectedIndex: number,
	labelFn: (item: T, idx: number) => string,
): string => items.map((item, idx) => menuCursor(idx === selectedIndex) + labelFn(item, idx)).join('\n');
