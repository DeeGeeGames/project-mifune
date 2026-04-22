import { definePlugin, type GameAction, type LegendEntry, type InputScheme, type AppScreenName, type World } from '../types';
import { TRIGGER_DEADZONE, STICK_ACTIVE_THRESHOLD, GP_AXIS_LS_X, GP_AXIS_LS_Y, GP_AXIS_RS_X, GP_AXIS_RS_Y } from '../constants';
import type { ActionMap } from 'ecspresso/plugins/input/input';

export type LegendSpec = {
	action: GameAction | null;
	label: string;
	keyboardOverride?: string | null;
	gamepadOverride?: string | null;
};

type ResolvedActionMap = Readonly<ActionMap<GameAction>>;

export const dpadVertical = (label: string): LegendSpec =>
	({ action: null, label, keyboardOverride: '↑↓', gamepadOverride: 'D-pad ↑↓' });

export const dpadHorizontal = (label: string): LegendSpec =>
	({ action: null, label, keyboardOverride: '←→', gamepadOverride: 'D-pad ←→' });

const KEY_GLYPHS: Partial<Record<string, string>> = {
	' ': 'Space',
	'ArrowUp': '↑',
	'ArrowDown': '↓',
	'ArrowLeft': '←',
	'ArrowRight': '→',
	'Enter': 'Enter',
	'Escape': 'Esc',
	'Tab': 'Tab',
};

const GAMEPAD_BUTTON_GLYPHS: Partial<Record<number, string>> = {
	0: 'A',
	1: 'B',
	2: 'X',
	3: 'Y',
	4: 'LB',
	5: 'RB',
	6: 'LT',
	7: 'RT',
	8: 'Back',
	9: 'Start',
	12: '↑',
	13: '↓',
	14: '←',
	15: '→',
};

const STICK_CLICK_BUTTONS = new Set([10, 11]);
const TRIGGER_BUTTONS = [6, 7] as const;
const STICK_AXES = [GP_AXIS_LS_X, GP_AXIS_LS_Y, GP_AXIS_RS_X, GP_AXIS_RS_Y] as const;
const GAMEPAD_POLL_BUTTONS = Array.from({ length: 16 }, (_, i) => i)
	.filter((b) => !STICK_CLICK_BUTTONS.has(b) && !(TRIGGER_BUTTONS as readonly number[]).includes(b));

const formatKeyGlyph = (key: string): string => KEY_GLYPHS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
const formatGamepadGlyph = (button: number): string => GAMEPAD_BUTTON_GLYPHS[button] ?? `B${button}`;

const resolveKeyboardLabel = (spec: LegendSpec, actions: ResolvedActionMap): string | null => {
	if (spec.keyboardOverride !== undefined) return spec.keyboardOverride;
	if (spec.action === null) return null;
	const keys = actions[spec.action]?.keys ?? [];
	return keys.length === 0 ? null : formatKeyGlyph(keys[0]!);
};

const resolveGamepadLabel = (spec: LegendSpec, actions: ResolvedActionMap): string | null => {
	if (spec.gamepadOverride !== undefined) return spec.gamepadOverride;
	if (spec.action === null) return null;
	const buttons = (actions[spec.action]?.gamepadButtons ?? []).filter((b) => !STICK_CLICK_BUTTONS.has(b.button));
	return buttons.length === 0 ? null : formatGamepadGlyph(buttons[0]!.button);
};

const buildLegendEntries = (specs: readonly LegendSpec[], actions: ResolvedActionMap): readonly LegendEntry[] =>
	specs.map((spec) => ({
		keyboard: resolveKeyboardLabel(spec, actions),
		gamepad: resolveGamepadLabel(spec, actions),
		label: spec.label,
	}));

export const setScreenLegend = (world: World, screen: AppScreenName, specs: readonly LegendSpec[]): void => {
	const legend = world.getResource('legend');
	const actions = world.getResource('inputState').getActionMap();
	legend.entriesByScreen[screen] = buildLegendEntries(specs, actions);
};

export const setExtraLegend = (world: World, specs: readonly LegendSpec[]): void => {
	const legend = world.getResource('legend');
	const actions = world.getResource('inputState').getActionMap();
	legend.extraEntries = buildLegendEntries(specs, actions);
};

export const clearExtraLegend = (world: World): void => {
	world.getResource('legend').extraEntries = [];
};

const renderLegend = (el: HTMLElement, entries: readonly LegendEntry[], extras: readonly LegendEntry[], scheme: InputScheme): void => {
	const parts = [...entries, ...extras]
		.map((e) => {
			const glyph = scheme === 'keyboard' ? e.keyboard : e.gamepad;
			if (glyph === null) return null;
			return e.label ? `[${glyph}] ${e.label}` : `[${glyph}]`;
		})
		.filter((s): s is string => s !== null);
	el.textContent = parts.join('  ·  ');
};

const detectGamepadActivity = (
	gamepads: ReadonlyArray<{ connected: boolean; justPressed(b: number): boolean; buttonValue(b: number): number; axis(i: number): number }>,
	prevTriggers: { values: number[][] },
): boolean => {
	const buttonHit = gamepads.some((gp) => gp.connected && GAMEPAD_POLL_BUTTONS.some((b) => gp.justPressed(b)));
	if (buttonHit) return true;
	const triggerHit = gamepads.some((gp, padIdx) => {
		if (!gp.connected) return false;
		return TRIGGER_BUTTONS.some((b) => {
			const prev = prevTriggers.values[padIdx]?.[b] ?? 0;
			return prev <= TRIGGER_DEADZONE && gp.buttonValue(b) > TRIGGER_DEADZONE;
		});
	});
	if (triggerHit) return true;
	return gamepads.some((gp) => gp.connected && STICK_AXES.some((a) => Math.abs(gp.axis(a)) > STICK_ACTIVE_THRESHOLD));
};

const updateTriggerSnapshot = (
	gamepads: ReadonlyArray<{ connected: boolean; buttonValue(b: number): number }>,
	prevTriggers: { values: number[][] },
): void => {
	gamepads.forEach((gp, padIdx) => {
		const slot = prevTriggers.values[padIdx] ?? [];
		TRIGGER_BUTTONS.forEach((b) => { slot[b] = gp.connected ? gp.buttonValue(b) : 0; });
		prevTriggers.values[padIdx] = slot;
	});
};

export const createLegendPlugin = () => definePlugin({
	id: 'legend',
	install: (world) => {
		const prevTriggers = { values: [] as number[][] };
		const keyboardActivity = { fired: false };

		const onKeyDown = (): void => { keyboardActivity.fired = true; };
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('mousedown', onKeyDown);

		const renderState = {
			lastScheme: null as InputScheme | null,
			lastScreen: null as AppScreenName | null,
			lastEntries: null as readonly LegendEntry[] | null,
			lastExtras: null as readonly LegendEntry[] | null,
		};

		world.addSystem('legend')
			.setPriority(10)
			.inPhase('preUpdate')
			.withResources(['inputState', 'legend', 'hudRefs'])
			.setProcess(({ resources: { inputState, legend, hudRefs } }) => {
				const anyConnected = inputState.gamepads.some((gp) => gp.connected);
				const gamepadFired = anyConnected && detectGamepadActivity(inputState.gamepads, prevTriggers);
				if (anyConnected) updateTriggerSnapshot(inputState.gamepads, prevTriggers);

				if (keyboardActivity.fired) legend.scheme = 'keyboard';
				else if (gamepadFired) legend.scheme = 'gamepad';
				keyboardActivity.fired = false;

				const screen = world.getCurrentScreen() as AppScreenName | null;
				const entries = (screen !== null ? legend.entriesByScreen[screen] : undefined) ?? null;
				const extras = legend.extraEntries;

				if (
					renderState.lastScheme === legend.scheme
					&& renderState.lastScreen === screen
					&& renderState.lastEntries === entries
					&& renderState.lastExtras === extras
				) return;

				renderLegend(hudRefs.legendEl, entries ?? [], extras, legend.scheme);
				renderState.lastScheme = legend.scheme;
				renderState.lastScreen = screen;
				renderState.lastEntries = entries;
				renderState.lastExtras = extras;
			});
	},
});
