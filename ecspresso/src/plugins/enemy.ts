import { definePlugin } from '../types';
import type { EnemyComponent } from '../types';
import type { EnemyKind } from '../enemies';
import { bearingXZ, leadTarget, distanceXZ, normalizeAngle } from '../math';
import { integrateKinematicXZ } from '../kinematic';
import {
	FLANK_OFFSET,
	HIT_ESCALATION_DECAY_RATE,
	ORBIT_RADIUS,
	ORBIT_BAND,
	ORBIT_STRIKE_INTERVAL_SEC,
	ORBIT_STRIKE_DURATION_SEC,
} from '../constants';

interface FlagshipSnapshot {
	readonly x: number;
	readonly z: number;
	readonly vx: number;
	readonly vz: number;
}

interface AiContext {
	readonly enemy: EnemyComponent;
	readonly ex: number;
	readonly ez: number;
	readonly flagship: FlagshipSnapshot;
	readonly dt: number;
}

const aimAt = (enemy: EnemyComponent, ex: number, ez: number, tx: number, tz: number): void => {
	enemy.headingTarget = bearingXZ(ex, ez, tx, tz);
};

const pursuer = ({ enemy, ex, ez, flagship }: AiContext): void => {
	aimAt(enemy, ex, ez, flagship.x, flagship.z);
	enemy.throttle = 1;
};

const interceptor = ({ enemy, ex, ez, flagship }: AiContext): void => {
	const lead = leadTarget(ex, ez, flagship.x, flagship.z, flagship.vx, flagship.vz, enemy.maxSpeed);
	aimAt(enemy, ex, ez, lead.x, lead.z);
	enemy.throttle = 1;
};

const flanker = ({ enemy, ex, ez, flagship }: AiContext): void => {
	if (enemy.behavior.kind !== 'flanker') return;
	const lead = leadTarget(ex, ez, flagship.x, flagship.z, flagship.vx, flagship.vz, enemy.maxSpeed);
	const fspeed = Math.sqrt(flagship.vx * flagship.vx + flagship.vz * flagship.vz);
	const hasVelocity = fspeed > 0.1;
	const perpX = hasVelocity ? -flagship.vz / fspeed : 0;
	const perpZ = hasVelocity ? flagship.vx / fspeed : 0;
	const targetX = lead.x + perpX * enemy.behavior.side * FLANK_OFFSET;
	const targetZ = lead.z + perpZ * enemy.behavior.side * FLANK_OFFSET;
	aimAt(enemy, ex, ez, targetX, targetZ);
	enemy.throttle = 1;
};

const orbiter = ({ enemy, ex, ez, flagship, dt }: AiContext): void => {
	if (enemy.behavior.kind !== 'orbiter') return;
	enemy.behavior.strikeTimer -= dt;

	const shouldStartStrike = enemy.behavior.mode === 'orbit' && enemy.behavior.strikeTimer <= 0;
	const shouldEndStrike = enemy.behavior.mode === 'strike' && enemy.behavior.strikeTimer <= -ORBIT_STRIKE_DURATION_SEC;

	if (shouldStartStrike) enemy.behavior.mode = 'strike';
	if (shouldEndStrike) {
		enemy.behavior.mode = 'orbit';
		enemy.behavior.strikeTimer = ORBIT_STRIKE_INTERVAL_SEC;
	}

	if (enemy.behavior.mode === 'strike') {
		const lead = leadTarget(ex, ez, flagship.x, flagship.z, flagship.vx, flagship.vz, enemy.maxSpeed);
		aimAt(enemy, ex, ez, lead.x, lead.z);
		enemy.throttle = 1;
		return;
	}

	const d = distanceXZ(ex, ez, flagship.x, flagship.z);
	const tooFar = d > ORBIT_RADIUS + ORBIT_BAND;
	const tooClose = d < ORBIT_RADIUS - ORBIT_BAND;

	if (tooFar) {
		aimAt(enemy, ex, ez, flagship.x, flagship.z);
		enemy.throttle = 1;
		return;
	}
	if (tooClose) {
		const bearing = bearingXZ(ex, ez, flagship.x, flagship.z);
		enemy.headingTarget = normalizeAngle(bearing + Math.PI);
		enemy.throttle = 1;
		return;
	}
	const bearing = bearingXZ(ex, ez, flagship.x, flagship.z);
	enemy.headingTarget = normalizeAngle(bearing + enemy.behavior.dir * Math.PI / 2);
	enemy.throttle = 0.7;
};

type KamikazeKind = Exclude<EnemyKind, 'gunship' | 'brawler' | 'sniper'>;

const AI_HANDLERS: Record<KamikazeKind, (ctx: AiContext) => void> = {
	pursuer,
	interceptor,
	flanker,
	orbiter,
};

const isKamikazeKind = (kind: EnemyKind): kind is KamikazeKind => kind in AI_HANDLERS;

export const createEnemyPlugin = () => definePlugin({
	id: 'enemy',
	install: (world) => {
		world.addSystem('enemy-ai')
			.setPriority(250)
			.inPhase('update')
			.addQuery('enemies', { with: ['enemy', 'localTransform3D'] })
			.addQuery('flagship', { with: ['commandVessel', 'localTransform3D', 'ship'] })
			.setProcess(({ queries, dt, ecs }) => {
				const flagship = queries.flagship[0];
				if (!flagship) return;
				const ft = flagship.components.localTransform3D;
				const fs = flagship.components.ship;
				const snapshot: FlagshipSnapshot = { x: ft.x, z: ft.z, vx: fs.vx, vz: fs.vz };

				for (const { id, components: { localTransform3D, enemy } } of queries.enemies) {
					if (enemy.hitEscalation > 0) {
						enemy.hitEscalation = Math.max(0, enemy.hitEscalation - HIT_ESCALATION_DECAY_RATE * dt);
					}
					if (isKamikazeKind(enemy.behavior.kind)) {
						const ctx: AiContext = {
							enemy,
							ex: localTransform3D.x,
							ez: localTransform3D.z,
							flagship: snapshot,
							dt,
						};
						AI_HANDLERS[enemy.behavior.kind](ctx);
					}
					integrateKinematicXZ(enemy, localTransform3D, dt);
					ecs.markChanged(id, 'localTransform3D');
				}
			});
	},
});
