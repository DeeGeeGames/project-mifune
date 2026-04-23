import { CylinderGeometry, Mesh, MeshStandardMaterial } from 'three';
import { MISSILE_PLUME_COLOR, MISSILE_PLUME_LENGTH, MISSILE_PLUME_SIZE } from '../constants';
import { attachEnginePlume, type EngineMount } from './mounts';

export function projectileMesh(): Mesh {
	const geo = new CylinderGeometry(0.08, 0.08, 0.5, 6);
	geo.rotateX(Math.PI / 2);
	const mat = new MeshStandardMaterial({ color: 0xffee88, emissive: 0xffaa33, emissiveIntensity: 1.2, roughness: 0.3 });
	return new Mesh(geo, mat);
}

const MISSILE_GEO = (() => {
	const g = new CylinderGeometry(0.1, 0.1, 0.8, 8);
	g.rotateX(Math.PI / 2);
	return g;
})();
const MISSILE_MAT = new MeshStandardMaterial({ color: 0xff5533, emissive: 0xaa2200, emissiveIntensity: 0.9, roughness: 0.4 });
MISSILE_GEO.userData.shared = true;
MISSILE_MAT.userData.shared = true;

export interface BuiltMissile {
	readonly mesh: Mesh;
	readonly engineMount: EngineMount;
}

export function buildMissile(): BuiltMissile {
	const mesh = new Mesh(MISSILE_GEO, MISSILE_MAT);
	const engineMount = attachEnginePlume(
		mesh,
		0.8, // missile mesh is 0.8 long along Z (rotated cylinder)
		MISSILE_PLUME_SIZE,
		MISSILE_PLUME_COLOR,
		0,
		MISSILE_PLUME_LENGTH,
	);
	return { mesh, engineMount };
}

const CANNON_SHELL_GEO = (() => {
	const g = new CylinderGeometry(0.16, 0.16, 0.6, 10);
	g.rotateX(Math.PI / 2);
	return g;
})();
const CANNON_SHELL_MAT = new MeshStandardMaterial({ color: 0xff7733, emissive: 0xdd3300, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.3 });
CANNON_SHELL_GEO.userData.shared = true;
CANNON_SHELL_MAT.userData.shared = true;

export function cannonShellMesh(): Mesh {
	return new Mesh(CANNON_SHELL_GEO, CANNON_SHELL_MAT);
}

const RAILGUN_SHELL_GEO = (() => {
	const g = new CylinderGeometry(0.05, 0.05, 1.2, 8);
	g.rotateX(Math.PI / 2);
	return g;
})();
const RAILGUN_SHELL_MAT = new MeshStandardMaterial({ color: 0xaaffff, emissive: 0x66ffff, emissiveIntensity: 2.0, roughness: 0.3, metalness: 0.5 });
RAILGUN_SHELL_GEO.userData.shared = true;
RAILGUN_SHELL_MAT.userData.shared = true;

export function railgunMesh(): Mesh {
	return new Mesh(RAILGUN_SHELL_GEO, RAILGUN_SHELL_MAT);
}

const PD_SHELL_GEO = (() => {
	const g = new CylinderGeometry(0.06, 0.06, 0.3, 6);
	g.rotateX(Math.PI / 2);
	return g;
})();
const PD_SHELL_MAT = new MeshStandardMaterial({ color: 0xffee66, emissive: 0xffaa22, emissiveIntensity: 1.4, roughness: 0.35 });
PD_SHELL_GEO.userData.shared = true;
PD_SHELL_MAT.userData.shared = true;

export function pdMesh(): Mesh {
	return new Mesh(PD_SHELL_GEO, PD_SHELL_MAT);
}
