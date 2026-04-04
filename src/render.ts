import type Phaser from "phaser";
import type { EntityId, GameState, Vec2 } from "./types.ts";
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
	WORLD_WIDTH,
	VIEWPORT_WIDTH,
	VIEWPORT_HEIGHT,
	RUNNER_RADIUS,
	TURRET_COST,
	RUNNER_COST,
	MAX_RUNNERS,
} from "./config.ts";

type RegionSprites = {
	readonly body: Phaser.GameObjects.Arc;
	readonly hpBarBg: Phaser.GameObjects.Rectangle;
	readonly hpBar: Phaser.GameObjects.Rectangle;
};

type SpriteRegistry = {
	readonly hudCamera: Phaser.Cameras.Scene2D.Camera;
	readonly turretBodies: Map<EntityId, Phaser.GameObjects.Arc>;
	readonly turretBarrels: Map<EntityId, Phaser.GameObjects.Line>;
	readonly turretRangeRings: Map<EntityId, Phaser.GameObjects.Arc>;
	readonly enemies: Map<EntityId, Phaser.GameObjects.Arc>;
	readonly bullets: Map<EntityId, Phaser.GameObjects.Arc>;
	readonly resources: Map<EntityId, Phaser.GameObjects.Arc>;
	readonly runners: Map<EntityId, Phaser.GameObjects.Arc>;
	readonly regions: Map<EntityId, RegionSprites>;
	readonly ground: Phaser.GameObjects.Rectangle;
	readonly targetSprite: Phaser.GameObjects.Arc;
	readonly defenseBar: Phaser.GameObjects.Rectangle;
	readonly defenseText: Phaser.GameObjects.Text;
	readonly waveText: Phaser.GameObjects.Text;
	readonly turretCountText: Phaser.GameObjects.Text;
	readonly controlModeText: Phaser.GameObjects.Text;
	readonly currencyText: Phaser.GameObjects.Text;
	readonly runnerCountText: Phaser.GameObjects.Text;
	readonly gameOverText: Phaser.GameObjects.Text;
	readonly instructionText: Phaser.GameObjects.Text;
};

function addHud(
	scene: Phaser.Scene,
	mainCam: Phaser.Cameras.Scene2D.Camera,
	obj: Phaser.GameObjects.GameObject,
): void {
	mainCam.ignore(obj);
}

function addWorld(
	hudCam: Phaser.Cameras.Scene2D.Camera,
	obj: Phaser.GameObjects.GameObject,
): void {
	hudCam.ignore(obj);
}

export function createSpriteRegistry(scene: Phaser.Scene): SpriteRegistry {
	const mainCam = scene.cameras.main;
	const hudCamera = scene.cameras.add(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
	hudCamera.setScroll(0, 0);

	// --- World objects ---
	const ground = scene.add.rectangle(
		WORLD_WIDTH / 2,
		GROUND_Y + 6,
		WORLD_WIDTH,
		12,
		0x445544,
	);
	ground.setDepth(2);
	addWorld(hudCamera, ground);

	const targetSprite = scene.add.circle(TARGET_X, TARGET_Y, TARGET_RADIUS, 0xffaa00);
	targetSprite.setStrokeStyle(3, 0xffffff);
	targetSprite.setDepth(5);
	addWorld(hudCamera, targetSprite);

	const defenseBar = scene.add.rectangle(TARGET_X, TARGET_Y - TARGET_RADIUS - 14, 40, 6, 0x44ff44);
	defenseBar.setDepth(6);
	addWorld(hudCamera, defenseBar);

	// --- HUD objects ---
	const defenseText = scene.add.text(10, 10, "", {
		fontSize: "18px",
		color: "#ff6666",
		fontFamily: "monospace",
	});
	defenseText.setDepth(10);
	addHud(scene, mainCam, defenseText);

	const waveText = scene.add.text(10, 36, "", {
		fontSize: "18px",
		color: "#aaaaff",
		fontFamily: "monospace",
	});
	waveText.setDepth(10);
	addHud(scene, mainCam, waveText);

	const turretCountText = scene.add.text(10, 62, "", {
		fontSize: "18px",
		color: "#88ff88",
		fontFamily: "monospace",
	});
	turretCountText.setDepth(10);
	addHud(scene, mainCam, turretCountText);

	const controlModeText = scene.add.text(10, 88, "", {
		fontSize: "16px",
		color: "#ffff88",
		fontFamily: "monospace",
	});
	controlModeText.setDepth(10);
	addHud(scene, mainCam, controlModeText);

	const currencyText = scene.add.text(10, 114, "", {
		fontSize: "18px",
		color: "#ffcc44",
		fontFamily: "monospace",
	});
	currencyText.setDepth(10);
	addHud(scene, mainCam, currencyText);

	const runnerCountText = scene.add.text(10, 140, "", {
		fontSize: "16px",
		color: "#44aaff",
		fontFamily: "monospace",
	});
	runnerCountText.setDepth(10);
	addHud(scene, mainCam, runnerCountText);

	const gameOverText = scene.add.text(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2, "GAME OVER", {
		fontSize: "64px",
		color: "#ff0000",
		fontFamily: "monospace",
		fontStyle: "bold",
	});
	gameOverText.setOrigin(0.5);
	gameOverText.setDepth(20);
	gameOverText.setVisible(false);
	addHud(scene, mainCam, gameOverText);

	const instructionText = scene.add.text(
		VIEWPORT_WIDTH / 2,
		VIEWPORT_HEIGHT - 20,
		"Click = place turret  |  T = control all  |  Click turret = control one  |  R = buy runner  |  ESC = release",
		{
			fontSize: "14px",
			color: "#666666",
			fontFamily: "monospace",
		},
	);
	instructionText.setOrigin(0.5);
	instructionText.setDepth(10);
	addHud(scene, mainCam, instructionText);

	return {
		hudCamera,
		turretBodies: new Map(),
		turretBarrels: new Map(),
		turretRangeRings: new Map(),
		enemies: new Map(),
		bullets: new Map(),
		resources: new Map(),
		runners: new Map(),
		regions: new Map(),
		ground,
		targetSprite,
		defenseBar,
		defenseText,
		waveText,
		turretCountText,
		controlModeText,
		currencyText,
		runnerCountText,
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
	time: number,
): void {
	const { hudCamera } = registry;

	// --- Regions ---
	const activeRegionIds = new Set(state.regions.map((r) => r.id));

	registry.regions.forEach((sprites, id) => {
		if (!activeRegionIds.has(id)) {
			sprites.body.destroy();
			sprites.hpBar.destroy();
			sprites.hpBarBg.destroy();
			registry.regions.delete(id);
		}
	});

	state.regions.forEach((region) => {
		const hpFraction = region.hp / region.maxHp;
		const lifeFraction = 1 - region.age / region.lifetime;
		const pulse = 0.55 + 0.2 * Math.sin(time * 0.004 + region.position.x);
		const regionColor = hpFraction > 0.5 ? 0xff6600 : hpFraction > 0.25 ? 0xff3300 : 0xff0000;

		const existing = registry.regions.get(region.id);
		if (existing) {
			existing.body.setPosition(region.position.x, region.position.y);
			existing.body.setRadius(region.radius);
			existing.body.setAlpha(pulse * lifeFraction);
			existing.body.setFillStyle(regionColor, 0.3);
			existing.body.setStrokeStyle(2, regionColor, pulse);

			const barWidth = 50;
			const barY = region.position.y - region.radius - 10;
			existing.hpBarBg.setPosition(region.position.x, barY);
			existing.hpBar.setPosition(
				region.position.x - barWidth / 2 + (barWidth * hpFraction) / 2,
				barY,
			);
			existing.hpBar.setScale(hpFraction, 1);
		} else {
			const barWidth = 50;
			const barY = region.position.y - region.radius - 10;

			const body = scene.add.circle(region.position.x, region.position.y, region.radius, regionColor, 0.3);
			body.setStrokeStyle(2, regionColor);
			body.setDepth(1);
			addWorld(hudCamera, body);

			const hpBarBg = scene.add.rectangle(region.position.x, barY, barWidth, 5, 0x333333);
			hpBarBg.setDepth(8);
			addWorld(hudCamera, hpBarBg);

			const hpBar = scene.add.rectangle(region.position.x, barY, barWidth, 5, 0xff6600);
			hpBar.setDepth(9);
			addWorld(hudCamera, hpBar);

			registry.regions.set(region.id, { body, hpBarBg, hpBar });
		}
	});

	// --- Turrets ---
	const activeTurretIds = new Set(state.turrets.map((t) => t.id));

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

		const existingBody = registry.turretBodies.get(turret.id);
		if (existingBody) {
			existingBody.setPosition(turret.position.x, turret.position.y);
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
			addWorld(hudCamera, body);
			registry.turretBodies.set(turret.id, body);
		}

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
			addWorld(hudCamera, barrel);
			registry.turretBarrels.set(turret.id, barrel);
		}

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
				addWorld(hudCamera, ring);
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
			addWorld(hudCamera, sprite);
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
			addWorld(hudCamera, sprite);
			registry.bullets.set(bullet.id, sprite);
		}
	});

	// --- Resources ---
	const activeResourceIds = new Set(state.resources.map((r) => r.id));

	registry.resources.forEach((sprite, id) => {
		if (!activeResourceIds.has(id)) {
			sprite.destroy();
			registry.resources.delete(id);
		}
	});

	state.resources.forEach((resource) => {
		const existing = registry.resources.get(resource.id);
		if (existing) {
			existing.setPosition(resource.position.x, resource.position.y);
		} else {
			const sprite = scene.add.circle(
				resource.position.x,
				resource.position.y,
				6,
				0x44ff44,
			);
			sprite.setStrokeStyle(1, 0x88ff88);
			sprite.setDepth(3);
			addWorld(hudCamera, sprite);
			registry.resources.set(resource.id, sprite);
		}
	});

	// --- Runners ---
	const activeRunnerIds = new Set(state.runners.map((r) => r.id));

	registry.runners.forEach((sprite, id) => {
		if (!activeRunnerIds.has(id)) {
			sprite.destroy();
			registry.runners.delete(id);
		}
	});

	state.runners.forEach((runner) => {
		const color = runner.state.tag === "returning" ? 0x44ffaa : 0x4488ff;
		const existing = registry.runners.get(runner.id);
		if (existing) {
			existing.setPosition(runner.position.x, runner.position.y);
			existing.setFillStyle(color);
		} else {
			const sprite = scene.add.circle(
				runner.position.x,
				runner.position.y,
				RUNNER_RADIUS,
				color,
			);
			sprite.setStrokeStyle(1, 0xffffff);
			sprite.setDepth(5);
			addWorld(hudCamera, sprite);
			registry.runners.set(runner.id, sprite);
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
		: `Wave ${state.wave.waveNumber}  |  Regions: ${state.regions.length + state.wave.regionsToSpawn}  |  Enemies: ${state.enemies.length}`;
	registry.waveText.setText(waveLabel);

	registry.turretCountText.setText(`Turrets: ${state.turrets.length}  (cost: ${TURRET_COST})`);

	const modeLabel =
		state.controlMode.tag === "none"
			? "Mode: Autonomous"
			: state.controlMode.tag === "all"
				? "Mode: Controlling ALL"
				: "Mode: Controlling ONE";
	registry.controlModeText.setText(modeLabel);

	registry.currencyText.setText(`Currency: ${state.currency}`);
	registry.runnerCountText.setText(`Runners: ${state.runners.length}/${MAX_RUNNERS}  (R to buy: ${RUNNER_COST})`);

	if (state.gameOver) {
		registry.gameOverText.setVisible(true);
	}
}
