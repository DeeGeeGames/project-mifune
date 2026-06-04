import { definePlugin, type World } from '../types';
import {
	campaignNodeById,
	campaignNodeStatus,
	missionLaunchForNode,
	reachableMissionNodes,
	type CampaignState,
	type CampaignMapNode,
} from '../campaign';
import { wrapIndex, renderMenuText, menuAxisDelta } from '../menu';
import { setScreenLegend, dpadVertical, dpadHorizontal, type LegendSpec } from './legend';

const LEGEND_SPECS: readonly LegendSpec[] = [
	dpadVertical('Navigate'),
	dpadHorizontal('Navigate'),
	{ action: 'menuConfirm', label: 'Deploy' },
	{ action: 'menuCancel', label: 'Back' },
];

type MapMenuItem =
	| { readonly kind: 'mission'; readonly node: CampaignMapNode }
	| { readonly kind: 'back' };

const mapMenuItems = (world: World): readonly MapMenuItem[] => [
	...reachableMissionNodes(world.getResource('campaignState')).map((node): MapMenuItem => ({ kind: 'mission', node })),
	{ kind: 'back' },
];

const mapMenuLabel = (item: MapMenuItem): string => {
	if (item.kind === 'back') return 'Back to Home Base';
	const mission = item.node.mission;
	if (!mission) return item.node.label;
	return `${item.node.label}: ${mission.label}`;
};

const nodeLine = (state: CampaignState, node: CampaignMapNode): string => {
	const status = campaignNodeStatus(state, node.id);
	const missionLabel = node.mission ? ` - ${node.mission.label}` : '';
	return `${node.label} [${status}]${missionLabel}`;
};

const mapDetailsText = (world: World, selectedItem: MapMenuItem | undefined): string => {
	const state = world.getResource('campaignState');
	const currentNode = campaignNodeById(state, state.currentNodeId);
	const selectedNode = selectedItem?.kind === 'mission' ? selectedItem.node : campaignNodeById(state, state.selectedNodeId);
	const nodesText = state.nodes.map((node) => nodeLine(state, node)).join('\n');
	return `Current location: ${currentNode.label}\n` +
		`Selected: ${selectedNode.label}\n\n` +
		nodesText;
};

const confirmItem = (world: World, item: MapMenuItem | undefined): void => {
	if (!item || item.kind === 'back') {
		void world.setScreen('homeBase', {});
		return;
	}
	const campaignState = world.getResource('campaignState');
	campaignState.selectedNodeId = item.node.id;
	const launch = missionLaunchForNode(campaignState, item.node.id);
	void world.setScreen('playing', { waveNumber: launch.waveNumber });
};

const clampSelection = (selectedIndex: number, itemCount: number): number =>
	itemCount <= 0 ? 0 : Math.min(selectedIndex, itemCount - 1);

export const createSectorMapPlugin = () => definePlugin({
	id: 'sectorMap',
	install: (world) => {
		let lastRenderKey = '';

		const renderMap = (ecs: World): void => {
			const state = ecs.getScreenState('sectorMap');
			const items = mapMenuItems(ecs);
			state.selectedIndex = clampSelection(state.selectedIndex, items.length);
			const selectedItem = items[state.selectedIndex];
			const campaignState = ecs.getResource('campaignState');
			if (selectedItem?.kind === 'mission') campaignState.selectedNodeId = selectedItem.node.id;
			const renderKey = `${state.selectedIndex}|${campaignState.currentNodeId}|${campaignState.selectedNodeId}|${campaignState.completedNodeIds.join(',')}|${campaignState.nextWaveNumber}`;
			if (renderKey === lastRenderKey) return;
			const hudRefs = ecs.getResource('hudRefs');
			hudRefs.summaryStatsEl.textContent = mapDetailsText(ecs, selectedItem);
			hudRefs.summaryMenuEl.textContent = renderMenuText(items, state.selectedIndex, mapMenuLabel);
			lastRenderKey = renderKey;
		};

		world.onScreenEnter('sectorMap', () => {
			const hudRefs = world.getResource('hudRefs');
			hudRefs.summaryTitleEl.textContent = 'SECTOR MAP';
			hudRefs.summaryEl.style.display = 'flex';
			lastRenderKey = '';
			setScreenLegend(world, 'sectorMap', LEGEND_SPECS);
			renderMap(world);
		});

		world.onScreenExit('sectorMap', () => {
			world.getResource('hudRefs').summaryEl.style.display = 'none';
		});

		world.addSystem('sector-map')
			.setPriority(100)
			.inPhase('update')
			.inScreens(['sectorMap'])
			.withResources(['inputState'])
			.setProcess(({ ecs, resources: { inputState } }) => {
				const state = ecs.getScreenState('sectorMap');
				const items = mapMenuItems(ecs);
				const verticalDelta = menuAxisDelta(inputState, 'menuUp', 'menuDown');
				const horizontalDelta = menuAxisDelta(inputState, 'menuLeft', 'menuRight');
				const delta = verticalDelta !== 0 ? verticalDelta : horizontalDelta;
				if (delta !== 0 && items.length > 0) {
					state.selectedIndex = wrapIndex(state.selectedIndex + delta, items.length);
				}
				if (inputState.actions.justActivated('menuCancel')) {
					void ecs.setScreen('homeBase', {});
					return;
				}
				if (inputState.actions.justActivated('menuConfirm')) {
					confirmItem(ecs, items[state.selectedIndex]);
					return;
				}
				renderMap(ecs);
			});
	},
});
