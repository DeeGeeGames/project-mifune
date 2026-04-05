import Phaser from "phaser";
import { sceneConfig } from "./scene.ts";
import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from "./config.ts";

new Phaser.Game({
	type: Phaser.AUTO,
	width: VIEWPORT_WIDTH,
	height: VIEWPORT_HEIGHT,
	backgroundColor: "#1a1a2e",
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	scene: sceneConfig,
});
