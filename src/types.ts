export type EntityId = string;

export type Vec2 = {
	readonly x: number;
	readonly y: number;
};

export type Turret = {
	readonly id: EntityId;
	readonly position: Vec2;
	readonly range: number;
	readonly fireRate: number;
	readonly lastFiredAt: number;
};

export type Enemy = {
	readonly id: EntityId;
	readonly position: Vec2;
	readonly speed: number;
	readonly hp: number;
};

export type Bullet = {
	readonly id: EntityId;
	readonly position: Vec2;
	readonly velocity: Vec2;
	readonly damage: number;
};

export type ControlMode =
	| { readonly tag: "none" }
	| { readonly tag: "all" }
	| { readonly tag: "single"; readonly turretId: EntityId };

export type WaveState = {
	readonly waveNumber: number;
	readonly enemiesRemaining: number;
	readonly spawnTimer: number;
	readonly spawnInterval: number;
	readonly betweenWaves: boolean;
	readonly intermissionTimer: number;
};

export type GameState = {
	readonly turrets: ReadonlyArray<Turret>;
	readonly enemies: ReadonlyArray<Enemy>;
	readonly bullets: ReadonlyArray<Bullet>;
	readonly controlMode: ControlMode;
	readonly wave: WaveState;
	readonly defenseHp: number;
	readonly gameOver: boolean;
};

export type InputIntent = {
	readonly pointerPosition: Vec2;
	readonly pointerDown: boolean;
	readonly controlMode: ControlMode;
	readonly placementRequested: Vec2 | null;
};

export type SpawnRequest = {
	readonly enemies: ReadonlyArray<Enemy>;
	readonly bullets: ReadonlyArray<Bullet>;
};

export type DestroyedEntities = {
	readonly bulletIds: ReadonlyArray<EntityId>;
	readonly enemyIds: ReadonlyArray<EntityId>;
};
