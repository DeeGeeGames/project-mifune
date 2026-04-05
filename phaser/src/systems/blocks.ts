import type { ArcRange, Block, BlockFace, GameState, Vec2 } from "../types.ts";
import {
	BLOCK_SIZE,
	BLOCK_HP,
	BLOCK_FACE_CLICK_THRESHOLD,
	ENEMY_RADIUS,
	GROUND_Y,
	GROUND_ARC_RANGE,
	PLACEMENT_MIN_X,
	PLACEMENT_MAX_X,
	RIGHT_FACE_ARC_RANGE,
	LEFT_FACE_ARC_RANGE,
} from "../config.ts";
import { makeId } from "../state.ts";
import { distance } from "./targeting.ts";

export const BLOCK_HALF = BLOCK_SIZE / 2;

export function createBlock(position: Vec2): Block {
	return {
		id: makeId(),
		position,
		hp: BLOCK_HP,
		maxHp: BLOCK_HP,
	};
}

function hasBlockAt(
	x: number,
	y: number,
	blocks: ReadonlyArray<Block>,
	excludeId?: string,
): boolean {
	return blocks.some(
		(b) => (excludeId === undefined || b.id !== excludeId) &&
			Math.abs(b.position.x - x) < 1 && Math.abs(b.position.y - y) < 1,
	);
}

type BlockAdjacency = "top" | "bottom" | "left" | "right";

const ADJACENCY_OFFSETS: Record<BlockAdjacency, Vec2> = {
	top: { x: 0, y: -BLOCK_SIZE },
	bottom: { x: 0, y: BLOCK_SIZE },
	left: { x: -BLOCK_SIZE, y: 0 },
	right: { x: BLOCK_SIZE, y: 0 },
};

function getOpenAdjacentPositions(
	block: Block,
	allBlocks: ReadonlyArray<Block>,
): ReadonlyArray<Vec2> {
	return (["top", "bottom", "left", "right"] as const)
		.map((face) => ({
			x: block.position.x + ADJACENCY_OFFSETS[face].x,
			y: block.position.y + ADJACENCY_OFFSETS[face].y,
		}))
		.filter((pos) => !hasBlockAt(pos.x, pos.y, allBlocks));
}

export function snapToBlockGrid(
	worldPos: Vec2,
	existingBlocks: ReadonlyArray<Block>,
): Vec2 {
	if (existingBlocks.length > 0) {
		const candidates = existingBlocks.flatMap((block) =>
			getOpenAdjacentPositions(block, existingBlocks).map((position) => ({
				position,
				dist: distance(worldPos, position),
			})),
		);

		if (candidates.length > 0) {
			const nearest = candidates.reduce((a, b) => (a.dist < b.dist ? a : b));
			if (nearest.dist < BLOCK_SIZE * 1.5) {
				return nearest.position;
			}
		}
	}

	const columnX = Math.round(worldPos.x / BLOCK_SIZE) * BLOCK_SIZE;
	return { x: columnX, y: GROUND_Y - BLOCK_HALF };
}

export function isValidBlockPlacement(
	snapped: Vec2,
	blocks: ReadonlyArray<Block>,
): boolean {
	if (snapped.x < PLACEMENT_MIN_X || snapped.x > PLACEMENT_MAX_X) return false;
	if (snapped.y < 0) return false;

	return !hasBlockAt(snapped.x, snapped.y, blocks);
}

const TURRET_FACE_OFFSETS: ReadonlyArray<{ face: BlockFace; dx: number; dy: number }> = [
	{ face: "top", dx: 0, dy: -1 },
	{ face: "left", dx: -1, dy: 0 },
	{ face: "right", dx: 1, dy: 0 },
] as const;

export function getExposedFaces(
	block: Block,
	allBlocks: ReadonlyArray<Block>,
): ReadonlyArray<BlockFace> {
	return TURRET_FACE_OFFSETS
		.filter(({ dx, dy }) => !hasBlockAt(
			block.position.x + dx * BLOCK_SIZE,
			block.position.y + dy * BLOCK_SIZE,
			allBlocks,
			block.id,
		))
		.map(({ face }) => face);
}

const FACE_OFFSETS: Record<BlockFace, Vec2> = {
	top: { x: 0, y: -BLOCK_HALF },
	left: { x: -BLOCK_HALF, y: 0 },
	right: { x: BLOCK_HALF, y: 0 },
};

export function faceCenterPosition(block: Block, face: BlockFace): Vec2 {
	const offset = FACE_OFFSETS[face];
	return { x: block.position.x + offset.x, y: block.position.y + offset.y };
}

const FACE_ARC_RANGES: Record<BlockFace, ArcRange> = {
	top: GROUND_ARC_RANGE,
	left: LEFT_FACE_ARC_RANGE,
	right: RIGHT_FACE_ARC_RANGE,
};

export function faceArcRange(face: BlockFace): ArcRange {
	return FACE_ARC_RANGES[face];
}

export function findClickedBlockFace(
	clickPos: Vec2,
	blocks: ReadonlyArray<Block>,
): { block: Block; face: BlockFace } | null {
	const candidates = blocks.flatMap((block) =>
		getExposedFaces(block, blocks).map((face) => ({
			block,
			face,
			dist: distance(clickPos, faceCenterPosition(block, face)),
		})),
	).filter((c) => c.dist < BLOCK_FACE_CLICK_THRESHOLD);

	if (candidates.length === 0) return null;

	const best = candidates.reduce((a, b) => (a.dist < b.dist ? a : b));
	return { block: best.block, face: best.face };
}

function circleAABBOverlap(
	circlePos: Vec2,
	radius: number,
	rectCenter: Vec2,
	halfW: number,
	halfH: number,
): boolean {
	const dx = Math.abs(circlePos.x - rectCenter.x);
	const dy = Math.abs(circlePos.y - rectCenter.y);
	if (dx > halfW + radius || dy > halfH + radius) return false;
	if (dx <= halfW || dy <= halfH) return true;
	const cornerDistSq = (dx - halfW) ** 2 + (dy - halfH) ** 2;
	return cornerDistSq <= radius ** 2;
}

export function tickBlockDamage(
	state: GameState,
): { state: GameState; destroyedEnemyPositions: ReadonlyArray<Vec2> } {
	if (state.blocks.length === 0) {
		return { state, destroyedEnemyPositions: [] };
	}

	const blockDamage = new Map<string, number>();
	const collidedEnemyIds = new Set<string>();

	state.enemies.forEach((enemy) => {
		if (collidedEnemyIds.has(enemy.id)) return;

		state.blocks.some((block) => {
			if (circleAABBOverlap(enemy.position, ENEMY_RADIUS, block.position, BLOCK_HALF, BLOCK_HALF)) {
				blockDamage.set(block.id, (blockDamage.get(block.id) ?? 0) + enemy.hp);
				collidedEnemyIds.add(enemy.id);
				return true;
			}
			return false;
		});
	});

	if (collidedEnemyIds.size === 0) {
		return { state, destroyedEnemyPositions: [] };
	}

	const destroyedEnemyPositions = state.enemies
		.filter((e) => collidedEnemyIds.has(e.id))
		.map((e) => e.position);

	const destroyedBlockIds = new Set(
		state.blocks
			.filter((b) => {
				const dmg = blockDamage.get(b.id) ?? 0;
				return dmg > 0 && b.hp - dmg <= 0;
			})
			.map((b) => b.id),
	);

	const blocks = state.blocks
		.filter((b) => !destroyedBlockIds.has(b.id))
		.map((b) => {
			const dmg = blockDamage.get(b.id) ?? 0;
			return dmg <= 0 ? b : { ...b, hp: b.hp - dmg };
		});

	const enemies = state.enemies.filter((e) => !collidedEnemyIds.has(e.id));

	const turrets = destroyedBlockIds.size > 0
		? state.turrets.filter((t) => t.parentBlockId === null || !destroyedBlockIds.has(t.parentBlockId))
		: state.turrets;

	return {
		state: { ...state, blocks, enemies, turrets },
		destroyedEnemyPositions,
	};
}
