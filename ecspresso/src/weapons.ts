export interface BurstFireState {
	fireIntervalMs: number;
	burstCount: number;
	burstShotDelayMs: number;
	shotsRemainingInBurst: number;
	lastFiredAt: number;
}

export const canFire = (b: BurstFireState, now: number): boolean => {
	const midBurst = b.shotsRemainingInBurst > 0;
	const requiredDelay = midBurst ? b.burstShotDelayMs : b.fireIntervalMs;
	return now - b.lastFiredAt >= requiredDelay;
};

export const recordShot = (b: BurstFireState, now: number): void => {
	const midBurst = b.shotsRemainingInBurst > 0;
	b.shotsRemainingInBurst = midBurst ? b.shotsRemainingInBurst - 1 : b.burstCount - 1;
	b.lastFiredAt = now;
};
