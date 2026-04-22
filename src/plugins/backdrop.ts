import { Color, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { definePlugin } from '../types';
import {
	BACKDROP_BASE_COLOR,
	BACKDROP_NEBULA_COLOR_A,
	BACKDROP_NEBULA_COLOR_B,
	GROUND_SIZE,
} from '../constants';

const vertexShader = /* glsl */`
	varying vec2 vWorld;
	void main() {
		vWorld = position.xy;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

const fragmentShader = /* glsl */`
	precision highp float;
	uniform float uTime;
	uniform vec3 uColorBase;
	uniform vec3 uColorNebulaA;
	uniform vec3 uColorNebulaB;
	varying vec2 vWorld;

	float hash(vec2 p) {
		return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
	}

	float valueNoise(vec2 p) {
		vec2 i = floor(p);
		vec2 f = fract(p);
		vec2 u = f * f * (3.0 - 2.0 * f);
		float a = hash(i);
		float b = hash(i + vec2(1.0, 0.0));
		float c = hash(i + vec2(0.0, 1.0));
		float d = hash(i + vec2(1.0, 1.0));
		return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
	}

	float fbm(vec2 p) {
		float v = 0.0;
		float a = 0.5;
		for (int i = 0; i < 4; i++) {
			v += a * valueNoise(p);
			p = p * 2.03 + vec2(37.0, 17.0);
			a *= 0.5;
		}
		return v;
	}

	void main() {
		vec2 pLow = vWorld * 0.035 + vec2(uTime * 0.020, uTime * 0.011);
		vec2 pHi  = vWorld * 0.095 + vec2(uTime * -0.014, uTime * 0.024);
		float nLow = fbm(pLow);
		float nHi  = fbm(pHi);

		float density = smoothstep(-0.15, 0.85, nLow + 0.35 * nHi);

		float hue = 0.5 + 0.5 * valueNoise(vWorld * 0.018 + vec2(uTime * 0.006, -uTime * 0.004));
		vec3 nebula = mix(uColorNebulaA, uColorNebulaB, hue);

		gl_FragColor = vec4(mix(uColorBase, nebula, density), 1.0);
	}
`;

export const createBackdropPlugin = () => definePlugin({
	id: 'backdrop',
	install: (world) => {
		const material = new ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uColorBase: { value: new Color(...BACKDROP_BASE_COLOR) },
				uColorNebulaA: { value: new Color(...BACKDROP_NEBULA_COLOR_A) },
				uColorNebulaB: { value: new Color(...BACKDROP_NEBULA_COLOR_B) },
			},
			vertexShader,
			fragmentShader,
			depthWrite: false,
		});
		const geometry = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
		const mesh = new Mesh(geometry, material);
		mesh.rotation.x = -Math.PI / 2;
		mesh.renderOrder = -1;

		world.addSystem('backdrop-init')
			.setOnInitialize((ecs) => {
				ecs.getResource('scene').add(mesh);
			})
			.setOnDetach(() => {
				mesh.removeFromParent();
				geometry.dispose();
				material.dispose();
			});

		world.addSystem('backdrop-tick')
			.setPriority(5)
			.inPhase('preUpdate')
			.setProcess(({ dt }) => {
				material.uniforms.uTime.value += dt;
			});
	},
});
