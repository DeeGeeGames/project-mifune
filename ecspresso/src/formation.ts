import { FORMATION_SPACING, FORMATION_ROW_SPACING } from './constants';
import type { PlayerState } from './types';

// row 1 has 3 positions but only 2 summoned slots — the command vessel occupies col 1.
const rowSlotCount = (row: number): number =>
	row === 0 ? 1 : row === 1 ? 2 : row * 2 + 1;

interface RowCol {
	row: number;
	colInFullRow: number;
	fullRowWidth: number;
}

const slotIndexToRowCol = (slotIndex: number): RowCol => {
	const walk = (row: number, remaining: number): RowCol => {
		const count = rowSlotCount(row);
		if (remaining < count) {
			// row 1: skip col 1 (command vessel).
			const colInRow = row === 1 && remaining >= 1 ? remaining + 1 : remaining;
			const fullRowWidth = row === 0 ? 1 : row * 2 + 1;
			return { row, colInFullRow: colInRow, fullRowWidth };
		}
		return walk(row + 1, remaining - count);
	};
	return walk(0, slotIndex);
};

export const slotLocalXZ = (slotIndex: number): { x: number; z: number } => {
	const { row, colInFullRow, fullRowWidth } = slotIndexToRowCol(slotIndex);
	const rowCenterCol = (fullRowWidth - 1) / 2;
	return {
		x: (colInFullRow - rowCenterCol) * FORMATION_SPACING,
		z: (1 - row) * FORMATION_ROW_SPACING,
	};
};

interface FormationEcs {
	getComponent: (id: number, name: 'formationSlot') => { flagshipId: number; slotIndex: number } | undefined;
	addComponent: (id: number, name: 'formationSlot', value: { flagshipId: number; slotIndex: number }) => void;
}

// Walks playerState.ownedShipIds in order, skipping the command vessel, and
// assigns each follower a contiguous slotIndex (0, 1, 2, …) plus the correct
// flagshipId. Idempotent — safe to call after any mutation of ownedShipIds
// (summon, command swap, future death handling).
export const reassignFormationSlots = (ecs: FormationEcs, playerState: PlayerState): void => {
	const { ownedShipIds, commandVesselId } = playerState;
	ownedShipIds
		.filter((id) => id !== commandVesselId)
		.forEach((id, slotIndex) => {
			const existing = ecs.getComponent(id, 'formationSlot');
			if (existing) {
				existing.flagshipId = commandVesselId;
				existing.slotIndex = slotIndex;
				return;
			}
			ecs.addComponent(id, 'formationSlot', { flagshipId: commandVesselId, slotIndex });
		});
};
