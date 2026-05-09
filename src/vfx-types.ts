import type { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three';

export interface MaterialFadeComponent {
	material: MeshBasicMaterial;
}

export interface EngineMountRef {
	readonly plume: Mesh;
	readonly plumeMat: MeshBasicMaterial;
	readonly size: number;
}

export interface EngineGlowComponent {
	material: MeshStandardMaterial;
	mounts: readonly EngineMountRef[];
}

export interface TrailComponent {
	ownerId: number;
	anchor: Object3D;
	geometry: BufferGeometry;
	material: MeshBasicMaterial;
	positionAttr: BufferAttribute;
	halfWidth: number;
	centers: Float32Array;
	initialized: boolean;
}

export interface VfxComponents {
	materialFade: MaterialFadeComponent;
	engineGlow: EngineGlowComponent;
	trail: TrailComponent;
}
