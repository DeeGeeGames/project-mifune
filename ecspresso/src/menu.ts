export const wrapIndex = (i: number, n: number): number => (i + n) % n;

export const renderMenuText = (
	items: ReadonlyArray<{ readonly label: string }>,
	selectedIndex: number,
): string => items
	.map((item, idx) => (idx === selectedIndex ? '▶ ' : '  ') + item.label)
	.join('\n');
