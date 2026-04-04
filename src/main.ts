import Phaser from "phaser";
import { sceneConfig } from "./scene.ts";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./config.ts";

new Phaser.Game({
	type: Phaser.AUTO,
	width: CANVAS_WIDTH,
	height: CANVAS_HEIGHT,
	backgroundColor: "#1a1a2e",
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	scene: sceneConfig,
});
