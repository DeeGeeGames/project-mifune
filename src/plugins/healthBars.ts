import { Group, Sprite, SpriteMaterial, Vector2 } from 'three';
import { definePlugin, type HealthBarComponent } from '../types';
import { clamp } from '../math';
import {
	HEALTH_BAR_BG_COLOR,
	HEALTH_BAR_COLOR_FULL,
	HEALTH_BAR_COLOR_LOW,
	HEALTH_BAR_COLOR_MID,
	HEALTH_BAR_HEIGHT,
	HEALTH_BAR_WIDTH_SCALE,
	HEALTH_BAR_Y_OFFSET,
} from '../constants';

const SHARED_BG_MAT = new SpriteMaterial({
	color: HEALTH_BAR_BG_COLOR,
	depthTest: false,
	transparent: true,
});

interface BuildHealthBarArgs {
	readonly parent: Group;
	readonly hullLength: number;
	readonly hullHeight: number;
}

export const buildHealthBar = ({ parent, hullLength, hullHeight }: BuildHealthBarArgs): HealthBarComponent => {
	const maxWidth = hullLength * HEALTH_BAR_WIDTH_SCALE;
	const y = hullHeight + HEALTH_BAR_Y_OFFSET;

	const bg = new Sprite(SHARED_BG_MAT);
	bg.center = new Vector2(0.5, 0.5);
	bg.position.set(0, y, 0);
	bg.scale.set(maxWidth, HEALTH_BAR_HEIGHT, 1);
	bg.renderOrder = 10;
	bg.visible = false;
	parent.add(bg);

	const fillMat = new SpriteMaterial({ color: HEALTH_BAR_COLOR_FULL, depthTest: false, transparent: true });
	const fill = new Sprite(fillMat);
	fill.center = new Vector2(0, 0.5);
	fill.position.set(-maxWidth / 2, y, 0);
	fill.scale.set(maxWidth, HEALTH_BAR_HEIGHT, 1);
	fill.renderOrder = 11;
	fill.visible = false;
	parent.add(fill);

	return { bg, fill, lastRatio: -1 };
};

const lerpColor = (a: number, b: number, t: number): number => {
	const ar = (a >> 16) & 0xff;
	const ag = (a >> 8) & 0xff;
	const ab = a & 0xff;
	const br = (b >> 16) & 0xff;
	const bg = (b >> 8) & 0xff;
	const bb = b & 0xff;
	const r = Math.round(ar + (br - ar) * t);
	const g = Math.round(ag + (bg - ag) * t);
	const bl = Math.round(ab + (bb - ab) * t);
	return (r << 16) | (g << 8) | bl;
};

const ratioColor = (ratio: number): number =>
	ratio > 0.5
		? lerpColor(HEALTH_BAR_COLOR_MID, HEALTH_BAR_COLOR_FULL, (ratio - 0.5) * 2)
		: lerpColor(HEALTH_BAR_COLOR_LOW, HEALTH_BAR_COLOR_MID, ratio * 2);

export const createHealthBarsPlugin = () => definePlugin({
	id: 'healthBars',
	install: (world) => {
		world.addSystem('healthBars')
			.inPhase('render')
			.inScreens(['playing'])
			.addQuery('enemies', { with: ['enemy', 'healthBar'] })
			.setProcess(({ queries }) => {
				for (const { components: { enemy, healthBar } } of queries.enemies) {
					const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
					if (ratio === healthBar.lastRatio) continue;
					const damaged = ratio < 1;
					healthBar.bg.visible = damaged;
					healthBar.fill.visible = damaged;
					healthBar.lastRatio = ratio;
					if (!damaged) continue;
					healthBar.fill.scale.x = healthBar.bg.scale.x * ratio;
					healthBar.fill.material.color.setHex(ratioColor(ratio));
				}
			});
	},
});
