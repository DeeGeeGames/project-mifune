import type Phaser from "phaser";
import type { EntityId, GameState, Turret, Vec2 } from "./types.ts";
import {
	TURRET_RADIUS,
	TURRET_BARREL_LENGTH,
	TURRET_RANGE,
	ENEMY_RADIUS,
	BULLET_RADIUS,
	TARGET_X,
	TARGET_Y,
	TARGET_RADIUS,
	DEFENSE_HP,
	GROUND_Y,
	CANVAS_WIDTH,
	BULLET_SPEED,
} from "./config.ts";

type SpriteRegistry = {
	readonly turretBodies: Map<EntityId, Phaser.GameObjects.Arc>;
	readonly turretBarrels: Map<EntityId, Phaser.GameObjects.Line>;
	readonly turretRangeRings: Map<EntityId, Phaser.GameObjects.Arc>;
	readonly enemies: Map<EntityId, Phaser.GameObjects.Arc>;
	readonly bullets: Map<EntityId, Phaser.GameObjects.Arc>;
	readonly ground: Phaser.GameObjects.Rectangle;
	readonly targetSprite: Phaser.GameObjects.Arc;
	readonly defenseBar: Phaser.GameObjects.Rectangle;
	readonly defenseText: Phaser.GameObjects.Text;
	readonly waveText: Phaser.GameObjects.Text;
	readonly turretCountText: Phaser.GameObjects.Text;
	readonly controlModeText: Phaser.GameObjects.Text;
	readonly gameOverText: Phaser.GameObjects.Text;
	readonly instructionText: Phaser.GameObjects.Text;
};

export function createSpriteRegistry(scene: Phaser.Scene): SpriteRegistry {
	const ground = scene.add.rectangle(
		CANVAS_WIDTH / 2,
		GROUND_Y + 6,
		CANVAS_WIDTH,
		12,
		0x445544,
	);
	ground.setDepth(2);

	const targetSprite = scene.add.circle(TARGET_X, TARGET_Y, TARGET_RADIUS, 0xffaa00);
	targetSprite.setStrokeStyle(3, 0xffffff);
	targetSprite.setDepth(5);

	const defenseBar = scene.add.rectangle(TARGET_X, TARGET_Y - TARGET_RADIUS - 14, 40, 6, 0x44ff44);
	defenseBar.setDepth(6);

	const defenseText = scene.add.text(10, 10, "", {
		fontSize: "18px",
		color: "#ff6666",
		fontFamily: "monospace",
	});
	defenseText.setDepth(10);

	const waveText = scene.add.text(10, 36, "", {
		fontSize: "18px",
		color: "#aaaaff",
		fontFamily: "monospace",
	});
	waveText.setDepth(10);

	const turretCountText = scene.add.text(10, 62, "", {
		fontSize: "18px",
		color: "#88ff88",
		fontFamily: "monospace",
	});
	turretCountText.setDepth(10);

	const controlModeText = scene.add.text(10, 88, "", {
		fontSize: "16px",
		color: "#ffff88",
		fontFamily: "monospace",
	});
	controlModeText.setDepth(10);

	const gameOverText = scene.add.text(640, 360, "GAME OVER", {
		fontSize: "64px",
		color: "#ff0000",
		fontFamily: "monospace",
		fontStyle: "bold",
	});
	gameOverText.setOrigin(0.5);
	gameOverText.setDepth(20);
	gameOverText.setVisible(false);

	const instructionText = scene.add.text(
		640,
		700,
		"Click to place turrets  |  T = control all  |  Click turret = control one  |  ESC = release",
		{
			fontSize: "14px",
			color: "#666666",
			fontFamily: "monospace",
		},
	);
	instructionText.setOrigin(0.5);
	instructionText.setDepth(10);

	return {
		turretBodies: new Map(),
		turretBarrels: new Map(),
		turretRangeRings: new Map(),
		enemies: new Map(),
		bullets: new Map(),
		ground,
		targetSprite,
		defenseBar,
		defenseText,
		waveText,
		turretCountText,
		controlModeText,
		gameOverText,
		instructionText,
	};
}

function getBarrelEnd(position: Vec2, angle: number): Vec2 {
	return {
		x: position.x + Math.cos(angle) * TURRET_BARREL_LENGTH,
		y: position.y + Math.sin(angle) * TURRET_BARREL_LENGTH,
	};
}

export function syncSprites(
	scene: Phaser.Scene,
	registry: SpriteRegistry,
	state: GameState,
	pointerPosition: Vec2,
): void {
	// --- Turrets ---
	const activeTurretIds = new Set(state.turrets.map((t) => t.id));

	// Remove turrets no longer in state
	registry.turretBodies.forEach((sprite, id) => {
		if (!activeTurretIds.has(id)) {
			sprite.destroy();
			registry.turretBodies.delete(id);
			registry.turretBarrels.get(id)?.destroy();
			registry.turretBarrels.delete(id);
			registry.turretRangeRings.get(id)?.destroy();
			registry.turretRangeRings.delete(id);
		}
	});

	state.turrets.forEach((turret) => {
		const isControlled =
			state.controlMode.tag === "all" ||
			(state.controlMode.tag === "single" &&
				state.controlMode.turretId === turret.id);

		// Body
		const existingBody = registry.turretBodies.get(turret.id);
		if (existingBody) {
			existingBody.setStrokeStyle(2, isControlled ? 0x00ffff : 0x44ff44);
			existingBody.setFillStyle(isControlled ? 0x004444 : 0x224422);
		} else {
			const body = scene.add.circle(
				turret.position.x,
				turret.position.y,
				TURRET_RADIUS,
				isControlled ? 0x004444 : 0x224422,
			);
			body.setStrokeStyle(2, isControlled ? 0x00ffff : 0x44ff44);
			body.setDepth(5);
			registry.turretBodies.set(turret.id, body);
		}

		// Barrel
		const barrelEnd = getBarrelEnd(turret.position, turret.aimAngle);

		const existingBarrel = registry.turretBarrels.get(turret.id);
		if (existingBarrel) {
			existingBarrel.setTo(
				turret.position.x,
				turret.position.y,
				barrelEnd.x,
				barrelEnd.y,
			);
			existingBarrel.setStrokeStyle(3, isControlled ? 0x00ffff : 0x44ff44);
		} else {
			const barrel = scene.add.line(
				0,
				0,
				turret.position.x,
				turret.position.y,
				barrelEnd.x,
				barrelEnd.y,
				isControlled ? 0x00ffff : 0x44ff44,
			);
			barrel.setLineWidth(3);
			barrel.setOrigin(0, 0);
			barrel.setDepth(6);
			registry.turretBarrels.set(turret.id, barrel);
		}

		// Range ring
		const existingRange = registry.turretRangeRings.get(turret.id);
		if (isControlled) {
			if (existingRange) {
				existingRange.setVisible(true);
				existingRange.setPosition(turret.position.x, turret.position.y);
			} else {
				const ring = scene.add.circle(
					turret.position.x,
					turret.position.y,
					TURRET_RANGE,
				);
				ring.setStrokeStyle(1, 0x00ffff, 0.2);
				ring.setFillStyle(0x000000, 0);
				ring.setDepth(1);
				registry.turretRangeRings.set(turret.id, ring);
			}
		} else if (existingRange) {
			existingRange.setVisible(false);
		}
	});

	// --- Enemies ---
	const activeEnemyIds = new Set(state.enemies.map((e) => e.id));

	registry.enemies.forEach((sprite, id) => {
		if (!activeEnemyIds.has(id)) {
			sprite.destroy();
			registry.enemies.delete(id);
		}
	});

	state.enemies.forEach((enemy) => {
		const existing = registry.enemies.get(enemy.id);
		if (existing) {
			existing.setPosition(enemy.position.x, enemy.position.y);
		} else {
			const sprite = scene.add.circle(
				enemy.position.x,
				enemy.position.y,
				ENEMY_RADIUS,
				0xff4422,
			);
			sprite.setDepth(4);
			registry.enemies.set(enemy.id, sprite);
		}
	});

	// --- Bullets ---
	const activeBulletIds = new Set(state.bullets.map((b) => b.id));

	registry.bullets.forEach((sprite, id) => {
		if (!activeBulletIds.has(id)) {
			sprite.destroy();
			registry.bullets.delete(id);
		}
	});

	state.bullets.forEach((bullet) => {
		const existing = registry.bullets.get(bullet.id);
		if (existing) {
			existing.setPosition(bullet.position.x, bullet.position.y);
		} else {
			const sprite = scene.add.circle(
				bullet.position.x,
				bullet.position.y,
				BULLET_RADIUS,
				0xffff44,
			);
			sprite.setDepth(3);
			registry.bullets.set(bullet.id, sprite);
		}
	});

	// --- HUD ---
	registry.defenseText.setText(`Defense: ${state.defenseHp}/${DEFENSE_HP}`);

	const hpFraction = state.defenseHp / DEFENSE_HP;
	const hpColor = hpFraction > 0.5 ? 0x44ff44 : hpFraction > 0.25 ? 0xffaa00 : 0xff2222;
	registry.defenseBar.setFillStyle(hpColor);
	registry.defenseBar.setScale(hpFraction, 1);

	const targetColor = hpFraction > 0.5 ? 0xffaa00 : hpFraction > 0.25 ? 0xff6600 : 0xff2222;
	registry.targetSprite.setFillStyle(targetColor);

	const waveLabel = state.wave.betweenWaves
		? `Wave ${state.wave.waveNumber} complete — next wave incoming`
		: `Wave ${state.wave.waveNumber}  (${state.wave.enemiesRemaining} remaining)`;
	registry.waveText.setText(waveLabel);

	registry.turretCountText.setText(`Turrets: ${state.turrets.length}`);

	const modeLabel =
		state.controlMode.tag === "none"
			? "Mode: Autonomous"
			: state.controlMode.tag === "all"
				? "Mode: Controlling ALL"
				: "Mode: Controlling ONE";
	registry.controlModeText.setText(modeLabel);

	if (state.gameOver) {
		registry.gameOverText.setVisible(true);
	}
}
