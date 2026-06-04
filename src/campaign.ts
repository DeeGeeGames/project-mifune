import type { LastMissionResult } from './screen-types';

export type MapNodeId = 'home-base' | 'patrol-alpha' | 'salvage-beta' | 'relay-gamma';

export type MapNodeKind = 'homeBase' | 'mission' | 'pointOfInterest';

export type MapNodeStatus = 'current' | 'reachable' | 'locked' | 'completed';

export type MissionType = 'waveSurvival';

export type CampaignMission = {
	readonly type: MissionType;
	readonly label: string;
	readonly waveNumberOffset: number;
};

export type CampaignMapNode = {
	readonly id: MapNodeId;
	readonly label: string;
	readonly kind: MapNodeKind;
	readonly x: number;
	readonly y: number;
	readonly connectedNodeIds: readonly MapNodeId[];
	readonly mission?: CampaignMission;
};

export type CampaignState = {
	currentNodeId: MapNodeId;
	completedNodeIds: readonly MapNodeId[];
	selectedNodeId: MapNodeId;
	nextWaveNumber: number;
	lastMissionResult?: LastMissionResult;
	readonly nodes: readonly CampaignMapNode[];
};

export type MissionLaunch = {
	readonly nodeId: MapNodeId;
	readonly waveNumber: number;
};

const INITIAL_NODES: readonly CampaignMapNode[] = [
	{
		id: 'home-base',
		label: 'Home Base',
		kind: 'homeBase',
		x: 16,
		y: 52,
		connectedNodeIds: ['patrol-alpha', 'salvage-beta'],
	},
	{
		id: 'patrol-alpha',
		label: 'Patrol Alpha',
		kind: 'mission',
		x: 44,
		y: 32,
		connectedNodeIds: ['home-base', 'relay-gamma'],
		mission: {
			type: 'waveSurvival',
			label: 'Wave Survival',
			waveNumberOffset: 0,
		},
	},
	{
		id: 'salvage-beta',
		label: 'Salvage Beta',
		kind: 'mission',
		x: 46,
		y: 72,
		connectedNodeIds: ['home-base'],
		mission: {
			type: 'waveSurvival',
			label: 'Wave Survival',
			waveNumberOffset: 1,
		},
	},
	{
		id: 'relay-gamma',
		label: 'Relay Gamma',
		kind: 'pointOfInterest',
		x: 78,
		y: 24,
		connectedNodeIds: ['patrol-alpha'],
	},
] as const;

export function createInitialCampaignState(): CampaignState {
	return {
		currentNodeId: 'home-base',
		completedNodeIds: [],
		selectedNodeId: 'patrol-alpha',
		nextWaveNumber: 1,
		nodes: INITIAL_NODES,
	};
}

export function campaignNodeById(state: CampaignState, nodeId: MapNodeId): CampaignMapNode {
	const node = state.nodes.find((candidate) => candidate.id === nodeId);
	if (!node) throw new Error(`Campaign node ${nodeId} is not defined`);
	return node;
}

export function campaignNodeStatus(state: CampaignState, nodeId: MapNodeId): MapNodeStatus {
	if (nodeId === state.currentNodeId) return 'current';
	if (state.completedNodeIds.includes(nodeId)) return 'completed';
	const currentNode = campaignNodeById(state, state.currentNodeId);
	if (currentNode.connectedNodeIds.includes(nodeId)) return 'reachable';
	return 'locked';
}

export function reachableMissionNodes(state: CampaignState): readonly CampaignMapNode[] {
	return state.nodes.filter((node) =>
		node.kind === 'mission' && campaignNodeStatus(state, node.id) === 'reachable'
	);
}

export function missionLaunchForNode(state: CampaignState, nodeId: MapNodeId): MissionLaunch {
	const node = campaignNodeById(state, nodeId);
	if (!node.mission) throw new Error(`Campaign node ${nodeId} does not have a mission`);
	return {
		nodeId,
		waveNumber: state.nextWaveNumber + node.mission.waveNumberOffset,
	};
}

export function campaignSummaryText(state: CampaignState): string {
	if (!state.lastMissionResult) return 'No missions completed';
	return `Last mission: Wave Survival\n` +
		`Enemies killed: ${state.lastMissionResult.kills}\n` +
		`Resources gained: ${state.lastMissionResult.resourcesCollected}`;
}

export function recordWaveSurvivalResult(state: CampaignState, result: LastMissionResult): void {
	state.nextWaveNumber = result.waveNumber + 1;
	state.lastMissionResult = result;
}
