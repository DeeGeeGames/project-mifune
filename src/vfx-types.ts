import type { BufferAttribute, BufferGeometry, MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three';
import type { EngineMount } from './ships';

export interface MaterialFadeComponent {
	material: MeshBasicMaterial;
}

export interface EngineGlowComponent {
	material: MeshStandardMaterial;
	mounts: readonly EngineMount[];
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
