import { DoubleSide, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { definePlugin, type World, type ShieldComponent } from '../types';
import type { ShipSpec } from '../ships';
import {
	SHIELD_COLOR,
	SHIELD_DEPLETED_DELAY_SEC,
	SHIELD_HP_PER_GENERATOR,
	SHIELD_OPACITY_FULL,
	SHIELD_OPACITY_LOW,
	SHIELD_REGEN_PER_GENERATOR_PER_SEC,
} from '../constants';

const SHIELD_GEO = new SphereGeometry(1, 24, 16);
SHIELD_GEO.userData.shared = true;

export interface BuiltShield {
	readonly mesh: Mesh;
	readonly material: MeshBasicMaterial;
}

export const createShieldBubble = (spec: ShipSpec): BuiltShield => {
	const material = new MeshBasicMaterial({
		color: SHIELD_COLOR,
		transparent: true,
		opacity: SHIELD_OPACITY_FULL,
		depthWrite: false,
		side: DoubleSide,
	});
	const mesh = new Mesh(SHIELD_GEO, material);
	// Center at hull mid-height so the y-offset doesn't consume the XZ budget.
	// x/z radii scaled to 1.7× and 1.3× half-extents so hull bottom corners
	// (±hullWidth/2, 0, ±hullLength/2) sit inside the ellipsoid: ~0.97 < 1.
	mesh.position.y = spec.hullHeight / 2;
	mesh.scale.set(
		spec.hullWidth * 0.85,
		spec.hullHeight * 3,
		spec.hullLength * 0.65,
	);
	return { mesh, material };
};

export const buildShieldComponent = (
	built: BuiltShield,
	generatorCount: number,
): ShieldComponent => {
	const max = generatorCount * SHIELD_HP_PER_GENERATOR;
	return {
		current: max,
		max,
		regenPerSec: generatorCount * SHIELD_REGEN_PER_GENERATOR_PER_SEC,
		mesh: built.mesh,
		material: built.material,
	};
};

interface AbsorbResult {
	readonly leftover: number;
	readonly depleted: boolean;
}

const absorbWithShield = (shield: ShieldComponent, damage: number): AbsorbResult => {
	const absorbed = Math.min(shield.current, damage);
	shield.current = Math.max(0, shield.current - absorbed);
	return { leftover: damage - absorbed, depleted: shield.current === 0 };
};

const armShieldDepletion = (ecs: World, shipId: number): void => {
	const slot = createTimer(SHIELD_DEPLETED_DELAY_SEC);
	const existing = ecs.getComponent(shipId, 'timers');
	if (existing) existing.shieldDepletion = slot;
	else ecs.addComponent(shipId, 'timers', { shieldDepletion: slot });
};

const isShieldLockedOut = (ecs: World, shipId: number): boolean =>
	ecs.getComponent(shipId, 'timers')?.shieldDepletion?.active === true;

export const applyDamageToShip = (
	ecs: World,
	shipId: number,
	damage: number,
	ship: { hp: number } | undefined = ecs.getComponent(shipId, 'ship'),
): void => {
	if (!ship) return;
	const shield = ecs.getComponent(shipId, 'shield');
	if (!shield || shield.current <= 0 || isShieldLockedOut(ecs, shipId)) {
		ship.hp -= damage;
		return;
	}
	const { leftover, depleted } = absorbWithShield(shield, damage);
	if (depleted) armShieldDepletion(ecs, shipId);
	ship.hp -= leftover;
};

const setMeshVisible = (mesh: { visible: boolean }, visible: boolean): void => {
	if (mesh.visible !== visible) mesh.visible = visible;
};

export const createShieldPlugin = () => definePlugin({
	id: 'shield',
	install: (world) => {
		world.addSystem('shield-update')
			.setPriority(320)
			.inPhase('update')
			.inScreens(['playing'])
			.setProcessEach({ with: ['shield'] }, ({ entity: { id, components: { shield } }, dt, ecs }) => {
				if (isShieldLockedOut(ecs, id)) {
					setMeshVisible(shield.mesh, false);
					return;
				}
				if (shield.current < shield.max) {
					shield.current = Math.min(shield.max, shield.current + shield.regenPerSec * dt);
				}
				const ratio = shield.max > 0 ? shield.current / shield.max : 0;
				setMeshVisible(shield.mesh, true);
				const nextOpacity = SHIELD_OPACITY_LOW + (SHIELD_OPACITY_FULL - SHIELD_OPACITY_LOW) * ratio;
				if (shield.material.opacity !== nextOpacity) shield.material.opacity = nextOpacity;
			});
	},
});
