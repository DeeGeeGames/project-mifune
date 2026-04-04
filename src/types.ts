export type EntityId = string;

export type Vec2 = {
	readonly x: number;
	readonly y: number;
};

export type Turret = {
	readonly id: EntityId;
	readonly position: Vec2;
	readonly lastFiredAt: number;
	readonly aimAngle: number;
	readonly ammo: number;
};

export type Enemy = {
	readonly id: EntityId;
	readonly position: Vec2;
	readonly velocity: Vec2;
	readonly speed: number;
	readonly hp: number;
	readonly spawnMomentum: Vec2;
	readonly momentumFactor: number; // 1.0 = full momentum, decays to 0
};

export type SpawnRegion = {
	readonly id: EntityId;
	readonly position: Vec2;
	readonly radius: number;
	readonly hp: number;
	readonly maxHp: number;
	readonly spawnInterval: number;
	readonly spawnTimer: number;
	readonly lifetime: number;
	readonly age: number;
};

export type Resource = {
	readonly id: EntityId;
	readonly position: Vec2;
	readonly value: number;
};

export type RunnerState =
	| { readonly tag: "idle" }
	| { readonly tag: "collecting"; readonly targetId: EntityId }
	| { readonly tag: "returning"; readonly carrying: number }
	| { readonly tag: "resupplying"; readonly targetId: EntityId };

export type RunnerPriority = "resources" | "ammo";

export type Runner = {
	readonly id: EntityId;
	readonly position: Vec2;
	readonly speed: number;
	readonly hp: number;
	readonly state: RunnerState;
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
	readonly regionsToSpawn: number;
	readonly regionSpawnTimer: number;
	readonly betweenWaves: boolean;
	readonly intermissionTimer: number;
};

export type GameState = {
	readonly turrets: ReadonlyArray<Turret>;
	readonly enemies: ReadonlyArray<Enemy>;
	readonly bullets: ReadonlyArray<Bullet>;
	readonly regions: ReadonlyArray<SpawnRegion>;
	readonly resources: ReadonlyArray<Resource>;
	readonly runners: ReadonlyArray<Runner>;
	readonly controlMode: ControlMode;
	readonly wave: WaveState;
	readonly defenseHp: number;
	readonly currency: number;
	readonly runnerPriority: RunnerPriority;
	readonly gameOver: boolean;
};