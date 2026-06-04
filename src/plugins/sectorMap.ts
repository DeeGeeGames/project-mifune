import { definePlugin, type World } from '../types';
import {
	campaignNodeById,
	campaignNodeStatus,
	missionLaunchForNode,
	reachableMapNodes,
	travelToNode,
	type CampaignState,
	type CampaignMapNode,
	type MapNodeStatus,
} from '../campaign';
import { wrapIndex, menuAxisDelta } from '../menu';
import { buildLabeledRow } from './statCardDom';
import { setScreenLegend, dpadVertical, dpadHorizontal, type LegendSpec } from './legend';

const SVG_NS = 'http://www.w3.org/2000/svg';

const LEGEND_SPECS: readonly LegendSpec[] = [
	dpadVertical('Navigate'),
	dpadHorizontal('Navigate'),
	{ action: 'menuConfirm', label: 'Select' },
	{ action: 'menuCancel', label: 'Back' },
];

type MapMenuItem =
	| { readonly kind: 'node'; readonly node: CampaignMapNode }
	| { readonly kind: 'back' };

const mapMenuItems = (world: World): readonly MapMenuItem[] => [
	...reachableMapNodes(world.getResource('campaignState')).map((node): MapMenuItem => ({ kind: 'node', node })),
	{ kind: 'back' },
];

const mapMenuLabel = (item: MapMenuItem): string => {
	if (item.kind === 'back') return 'Back to Home Base';
	const mission = item.node.mission;
	if (!mission) return `${item.node.label}: Travel`;
	return `${item.node.label}: ${mission.label}`;
};

const statusLabel = (status: MapNodeStatus): string => {
	if (status === 'current') return 'Current location';
	if (status === 'reachable') return 'Reachable';
	if (status === 'completed') return 'Completed';
	return 'Locked';
};

const nodeClasses = (
	status: MapNodeStatus,
	isSelected: boolean,
): string => [
	'sector-map-node',
	`sector-map-node--${status}`,
	isSelected ? 'sector-map-node--selected' : '',
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
	onSelectNode: (node: CampaignMapNode) => void,
): void => {
	const status = campaignNodeStatus(state, node.id);
	const group = document.createElementNS(SVG_NS, 'g');
	group.setAttribute('class', nodeClasses(status, node.id === selectedNode.id));
	group.setAttribute('transform', `translate(${node.x} ${node.y})`);
	if (status === 'reachable') {
		group.setAttribute('tabindex', '0');
		group.setAttribute('role', 'button');
		group.addEventListener('click', () => onSelectNode(node));
	}

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
	selectedItem?.kind === 'node'
		? selectedItem.node
		: campaignNodeById(state, state.selectedNodeId);

const buildHeader = (className: string, text: string): HTMLElement => {
	const el = document.createElement('div');
	el.className = className;
	el.textContent = text;
	return el;
};

const selectedNodeRows = (
	state: CampaignState,
	selectedNode: CampaignMapNode,
): readonly { readonly label: string; readonly value: string }[] => {
	const status = campaignNodeStatus(state, selectedNode.id);
	const baseRows = [
		{ label: 'Status', value: statusLabel(status) },
		{ label: 'Mission', value: selectedNode.mission?.label ?? 'No deployment' },
	];
	if (!selectedNode.mission) return baseRows;
	return [
		...baseRows,
		{ label: 'Wave', value: `${state.nextWaveNumber + selectedNode.mission.waveNumberOffset}` },
		...selectedNode.mission.rewards,
	];
};

const buildNodeDetails = (state: CampaignState, selectedNode: CampaignMapNode): HTMLElement => {
	const details = document.createElement('div');
	details.className = 'sector-map-details';
	const mission = selectedNode.mission;
	const currentNode = campaignNodeById(state, state.currentNodeId);
	const briefing = document.createElement('div');
	briefing.className = 'sector-map-briefing';
	briefing.textContent = mission?.briefing ?? 'No deployment selected from this location.';
	const rows = selectedNodeRows(state, selectedNode)
		.map(({ label, value }) => buildLabeledRow('sector-map-detail-row', label, value));
	details.replaceChildren(
		buildHeader('sector-map-current', `Current: ${currentNode.label}`),
		buildHeader('sector-map-detail-title', selectedNode.label),
		briefing,
		...rows,
	);
	return details;
};

const buildMapVisual = (
	state: CampaignState,
	selectedNode: CampaignMapNode,
	onSelectNode: (node: CampaignMapNode) => void,
): HTMLElement => {
	const root = document.createElement('div');
	root.className = 'sector-map';

	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('class', 'sector-map-svg');
	svg.setAttribute('viewBox', '0 0 100 100');
	mapEdges(state).forEach(([a, b]) => appendSvgLine(svg, a, b));
	state.nodes.forEach((node) => appendSvgNode(svg, state, node, selectedNode, onSelectNode));

	root.append(svg, buildNodeDetails(state, selectedNode));
	return root;
};

const buildRouteCard = (
	item: MapMenuItem,
	idx: number,
	selectedIndex: number,
	onConfirm: (item: MapMenuItem) => void,
): HTMLElement => {
	const card = document.createElement('div');
	card.className = ['sector-map-route-card', idx === selectedIndex ? 'sector-map-route-card--selected' : '']
		.filter(Boolean)
		.join(' ');
	card.append(buildHeader('sector-map-route-title', mapMenuLabel(item)));
	card.addEventListener('click', () => onConfirm(item));
	return card;
};

const renderMapBody = (
	world: World,
	items: readonly MapMenuItem[],
	selectedIndex: number,
	selectedItem: MapMenuItem | undefined,
	onSelectNode: (node: CampaignMapNode) => void,
	onConfirm: (item: MapMenuItem) => void,
): void => {
	const state = world.getResource('campaignState');
	const selectedNode = selectedNodeForItem(state, selectedItem);
	const hudRefs = world.getResource('hudRefs');
	hudRefs.sectorMapBodyEl.replaceChildren(buildMapVisual(state, selectedNode, onSelectNode));
	hudRefs.sectorMapRouteEl.replaceChildren(
		...items.map((item, idx) => buildRouteCard(item, idx, selectedIndex, onConfirm)),
	);
};

const updateSelectedNode = (world: World, selectedItem: MapMenuItem | undefined): void => {
	if (selectedItem?.kind !== 'node') return;
	world.getResource('campaignState').selectedNodeId = selectedItem.node.id;
};

const renderKeyFor = (
	state: CampaignState,
	selectedIndex: number,
	selectedItem: MapMenuItem | undefined,
): string => {
	const selectedNodeId = selectedItem?.kind === 'node' ? selectedItem.node.id : state.selectedNodeId;
	return `${selectedIndex}|${state.currentNodeId}|${selectedNodeId}|${state.completedNodeIds.join(',')}|${state.nextWaveNumber}`;
};

const confirmItem = (world: World, item: MapMenuItem | undefined): void => {
	if (!item || item.kind === 'back') {
		void world.setScreen('homeBase', {});
		return;
	}
	const campaignState = world.getResource('campaignState');
	campaignState.selectedNodeId = item.node.id;
	if (!item.node.mission) {
		travelToNode(campaignState, item.node.id);
		return;
	}
	const launch = missionLaunchForNode(campaignState, item.node.id);
	void world.setScreen('playing', {
		mission: launch,
	});
};

const clampSelection = (selectedIndex: number, itemCount: number): number =>
	itemCount <= 0 ? 0 : Math.min(selectedIndex, itemCount - 1);

const selectedIndexForNode = (items: readonly MapMenuItem[], node: CampaignMapNode): number | null => {
	const idx = items.findIndex((item) => item.kind === 'node' && item.node.id === node.id);
	return idx >= 0 ? idx : null;
};

export const createSectorMapPlugin = () => definePlugin({
	id: 'sectorMap',
	install: (world) => {
		let lastRenderKey = '';

		const selectNode = (ecs: World, node: CampaignMapNode): void => {
			const state = ecs.getScreenState('sectorMap');
			const items = mapMenuItems(ecs);
			const selectedIndex = selectedIndexForNode(items, node);
			if (selectedIndex === null) return;
			state.selectedIndex = selectedIndex;
			ecs.getResource('campaignState').selectedNodeId = node.id;
			lastRenderKey = '';
			renderMap(ecs);
		};

		const renderMap = (ecs: World): void => {
			const state = ecs.getScreenState('sectorMap');
			const items = mapMenuItems(ecs);
			state.selectedIndex = clampSelection(state.selectedIndex, items.length);
			const selectedItem = items[state.selectedIndex];
			const campaignState = ecs.getResource('campaignState');
			updateSelectedNode(ecs, selectedItem);
			const renderKey = renderKeyFor(campaignState, state.selectedIndex, selectedItem);
			if (renderKey === lastRenderKey) return;
			renderMapBody(
				ecs,
				items,
				state.selectedIndex,
				selectedItem,
				(node) => selectNode(ecs, node),
				(item) => confirmItem(ecs, item),
			);
			lastRenderKey = renderKey;
		};

		world.onScreenEnter('sectorMap', () => {
			const hudRefs = world.getResource('hudRefs');
			hudRefs.sectorMapTitleEl.textContent = 'SECTOR MAP';
			hudRefs.sectorMapEl.style.display = 'flex';
			lastRenderKey = '';
			setScreenLegend(world, 'sectorMap', LEGEND_SPECS);
			renderMap(world);
		});

		world.onScreenExit('sectorMap', () => {
			world.getResource('hudRefs').sectorMapEl.style.display = 'none';
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
