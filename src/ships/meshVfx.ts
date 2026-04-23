import {
	AdditiveBlending,
	BoxGeometry,
	CylinderGeometry,
	DoubleSide,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	RingGeometry,
	SphereGeometry,
} from 'three';

interface BuiltBlast {
	readonly mesh: Mesh;
	readonly material: MeshBasicMaterial;
}

const BLAST_GEO = (() => {
	const g = new RingGeometry(0.82, 1.0, 32);
	g.rotateX(-Math.PI / 2);
	return g;
})();

export function createBlast(): BuiltBlast {
	const material = new MeshBasicMaterial({
		color: 0xff8844,
		transparent: true,
		opacity: 0.9,
		side: DoubleSide,
		depthWrite: false,
	});
	const mesh = new Mesh(BLAST_GEO, material);
	return { mesh, material };
}

export function pickupMesh(): Mesh {
	const geo = new BoxGeometry(0.35, 0.35, 0.35);
	const mat = new MeshStandardMaterial({ color: 0xffcc33, emissive: 0xaa7711, emissiveIntensity: 0.8, roughness: 0.35, metalness: 0.6 });
	const mesh = new Mesh(geo, mat);
	mesh.position.y = 0.25;
	return mesh;
}

export interface BuiltVfx {
	readonly mesh: Mesh;
	readonly material: MeshBasicMaterial;
}

const EXPLOSION_GEO = new SphereGeometry(1, 16, 10);
EXPLOSION_GEO.userData.shared = true;

export function createExplosionMesh(tint: number, opacity: number): BuiltVfx {
	const material = new MeshBasicMaterial({
		color: tint,
		transparent: true,
		opacity,
		blending: AdditiveBlending,
		depthWrite: false,
	});
	return { mesh: new Mesh(EXPLOSION_GEO, material), material };
}

const MUZZLE_FLASH_GEO = (() => {
	const g = new CylinderGeometry(0.05, 0.22, 0.9, 10);
	g.rotateX(Math.PI / 2);
	g.translate(0, 0, 0.3);
	return g;
})();
MUZZLE_FLASH_GEO.userData.shared = true;

export function createMuzzleFlashMesh(tint: number): BuiltVfx {
	const material = new MeshBasicMaterial({
		color: tint,
		transparent: true,
		opacity: 0.95,
		blending: AdditiveBlending,
		depthWrite: false,
	});
	return { mesh: new Mesh(MUZZLE_FLASH_GEO, material), material };
}

const IMPACT_SPARK_GEO = new SphereGeometry(0.35, 10, 6);
IMPACT_SPARK_GEO.userData.shared = true;

export function createImpactSparkMesh(tint: number): BuiltVfx {
	const material = new MeshBasicMaterial({
		color: tint,
		transparent: true,
		opacity: 0.9,
		blending: AdditiveBlending,
		depthWrite: false,
	});
	return { mesh: new Mesh(IMPACT_SPARK_GEO, material), material };
}
