import { definePlugin, type World } from '../types';
import {
	campaignNodeById,
	campaignNodeStatus,
	missionLaunchForNode,
	reachableMissionNodes,
	type CampaignState,
	type CampaignMapNode,
	type MapNodeStatus,
} from '../campaign';
import { wrapIndex, renderMenuText, menuAxisDelta } from '../menu';
import { setScreenLegend, dpadVertical, dpadHorizontal, type LegendSpec } from './legend';

const SVG_NS = 'http://www.w3.org/2000/svg';

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

const statusLabel = (status: MapNodeStatus): string => {
	if (status === 'current') return 'Current location';
	if (status === 'reachable') return 'Reachable';
	if (status === 'completed') return 'Completed';
	return 'Locked';
};

const nodeClasses = (
	state: CampaignState,
	node: CampaignMapNode,
	selectedNode: CampaignMapNode,
): string => [
	'sector-map-node',
	`sector-map-node--${campaignNodeStatus(state, node.id)}`,
	node.id === selectedNode.id ? 'sector-map-node--selected' : '',
].filter(Boolean).join(' ');

const mapEdges = (state: CampaignState): readonly (readonly [CampaignMapNode, CampaignMapNode])[] => {
	const edges = state.nodes.flatMap((node) =>
		node.connectedNodeIds.map((targetId) => [node, campaignNodeById(state, targetId)] as const)
	);
	return edges.filter(([a, b]) =>
		state.nodes.indexOf(a) < state.nodes.indexOf(b)
	);
};

const appendSvgLine = (svg: SVGSVGElement, a: CampaignMapNode, b: CampaignMapNode): void => {
	const line = document.createElementNS(SVG_NS, 'line');
	line.setAttribute('x1', `${a.x}`);
	line.setAttribute('y1', `${a.y}`);
	line.setAttribute('x2', `${b.x}`);
	line.setAttribute('y2', `${b.y}`);
	line.setAttribute('class', 'sector-map-edge');
	svg.append(line);
};

const appendSvgNode = (
	svg: SVGSVGElement,
	state: CampaignState,
	node: CampaignMapNode,
	selectedNode: CampaignMapNode,
): void => {
	const group = document.createElementNS(SVG_NS, 'g');
	group.setAttribute('class', nodeClasses(state, node, selectedNode));
	group.setAttribute('transform', `translate(${node.x} ${node.y})`);

	const circle = document.createElementNS(SVG_NS, 'circle');
	circle.setAttribute('r', node.kind === 'homeBase' ? '6.5' : '5.2');
	group.append(circle);

	const label = document.createElementNS(SVG_NS, 'text');
	label.setAttribute('x', '0');
	label.setAttribute('y', '12');
	label.textContent = node.label;
	group.append(label);

	svg.append(group);
};

const selectedNodeForItem = (
	state: CampaignState,
	selectedItem: MapMenuItem | undefined,
): CampaignMapNode =>
	selectedItem?.kind === 'mission'
		? selectedItem.node
		: campaignNodeById(state, state.selectedNodeId);

const selectedNodeDetailText = (state: CampaignState, selectedNode: CampaignMapNode): string => {
	const status = campaignNodeStatus(state, selectedNode.id);
	const missionLabel = selectedNode.mission?.label ?? 'No mission';
	const waveLabel = selectedNode.mission
		? `Wave ${state.nextWaveNumber + selectedNode.mission.waveNumberOffset}`
		: 'No deployment';
	return `${selectedNode.label}\n` +
		`${statusLabel(status)}\n` +
		`${missionLabel}\n` +
		waveLabel;
};

const buildMapVisual = (state: CampaignState, selectedNode: CampaignMapNode): HTMLElement => {
	const root = document.createElement('div');
	root.className = 'sector-map';

	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('class', 'sector-map-svg');
	svg.setAttribute('viewBox', '0 0 100 100');
	mapEdges(state).forEach(([a, b]) => appendSvgLine(svg, a, b));
	state.nodes.forEach((node) => appendSvgNode(svg, state, node, selectedNode));

	const details = document.createElement('div');
	details.className = 'sector-map-details';

	const currentNode = campaignNodeById(state, state.currentNodeId);
	const current = document.createElement('div');
	current.className = 'sector-map-current';
	current.textContent = `Current: ${currentNode.label}`;

	const selected = document.createElement('div');
	selected.className = 'sector-map-selected';
	selected.textContent = selectedNodeDetailText(state, selectedNode);

	details.append(current, selected);
	root.append(svg, details);
	return root;
};

const renderMapBody = (world: World, selectedItem: MapMenuItem | undefined): void => {
	const state = world.getResource('campaignState');
	const selectedNode = selectedNodeForItem(state, selectedItem);
	world.getResource('hudRefs').summaryStatsEl.replaceChildren(buildMapVisual(state, selectedNode));
};

const updateSelectedNode = (world: World, selectedItem: MapMenuItem | undefined): void => {
	if (selectedItem?.kind !== 'mission') return;
	world.getResource('campaignState').selectedNodeId = selectedItem.node.id;
};

const renderKeyFor = (
	state: CampaignState,
	selectedIndex: number,
	selectedItem: MapMenuItem | undefined,
): string => {
	const selectedNodeId = selectedItem?.kind === 'mission' ? selectedItem.node.id : state.selectedNodeId;
	return `${selectedIndex}|${state.currentNodeId}|${selectedNodeId}|${state.completedNodeIds.join(',')}|${state.nextWaveNumber}`;
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
			updateSelectedNode(ecs, selectedItem);
			const renderKey = renderKeyFor(campaignState, state.selectedIndex, selectedItem);
			if (renderKey === lastRenderKey) return;
			const hudRefs = ecs.getResource('hudRefs');
			renderMapBody(ecs, selectedItem);
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
