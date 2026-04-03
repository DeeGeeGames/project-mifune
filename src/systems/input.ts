import type { ControlMode, Turret, Vec2 } from "../types.ts";
import { TURRET_RADIUS } from "../config.ts";
import { distance } from "./targeting.ts";

export function findClickedTurret(
	position: Vec2,
	turrets: ReadonlyArray<Turret>,
): Turret | null {
	const hit = turrets.find(
		(t) => distance(t.position, position) <= TURRET_RADIUS * 1.5,
	);
	return hit ?? null;
}

export function resolveControlMode(
	current: ControlMode,
	toggleAllPressed: boolean,
	escapePressed: boolean,
	rightClicked: boolean,
	clickedTurret: Turret | null,
	pointerDown: boolean,
): ControlMode {
	if (escapePressed || rightClicked) return { tag: "none" };
	if (toggleAllPressed) return current.tag === "all" ? { tag: "none" } : { tag: "all" };

	if (current.tag === "none" && pointerDown && clickedTurret) {
		return { tag: "single", turretId: clickedTurret.id };
	}

	return current;
}
