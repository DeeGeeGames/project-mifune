import { DoubleSide, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
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
	mesh.position.y = spec.hullHeight;
	mesh.scale.set(
		spec.hullWidth / 2 + 0.4,
		spec.hullHeight * 2.5,
		spec.hullLength / 2 + 0.4,
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
		depletedDelaySec: SHIELD_DEPLETED_DELAY_SEC,
		depletedTimer: 0,
		mesh: built.mesh,
		material: built.material,
	};
};

const absorbWithShield = (shield: ShieldComponent, damage: number): number => {
	const absorbed = Math.min(shield.current, damage);
	const leftover = damage - absorbed;
	shield.current = Math.max(0, shield.current - absorbed);
	if (shield.current === 0) shield.depletedTimer = shield.depletedDelaySec;
	return leftover;
};

export const applyDamageToShip = (
	ecs: World,
	shipId: number,
	damage: number,
	ship: { hp: number } | undefined = ecs.getComponent(shipId, 'ship'),
): void => {
	if (!ship) return;
	const shield = ecs.getComponent(shipId, 'shield');
	const leftover = shield && shield.depletedTimer === 0 && shield.current > 0
		? absorbWithShield(shield, damage)
		: damage;
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
			.addQuery('shields', { with: ['shield'] })
			.setProcess(({ queries, dt }) => {
				for (const { components: { shield } } of queries.shields) {
					if (shield.depletedTimer > 0) {
						shield.depletedTimer = Math.max(0, shield.depletedTimer - dt);
						setMeshVisible(shield.mesh, false);
						continue;
					}
					if (shield.current < shield.max) {
						shield.current = Math.min(shield.max, shield.current + shield.regenPerSec * dt);
					}
					const ratio = shield.max > 0 ? shield.current / shield.max : 0;
					setMeshVisible(shield.mesh, true);
					const nextOpacity = SHIELD_OPACITY_LOW + (SHIELD_OPACITY_FULL - SHIELD_OPACITY_LOW) * ratio;
					if (shield.material.opacity !== nextOpacity) shield.material.opacity = nextOpacity;
				}
			});
	},
});
