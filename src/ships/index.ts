export type {
	AuxiliaryKind,
	AuxiliaryMount,
	CarrierLoadout,
	CarrierLoadoutAux,
	CarrierLoadoutPair,
	CarrierLoadoutPylon,
	EmptyTurretMount,
	PairSlotDef,
	PairSlotId,
	PylonCategory,
	WeaponKind,
} from './loadout';
export { PAIR_SLOTS, pylonArc, pylonsConsumedByPairs } from './loadout';

export type {
	BeamTurretMount,
	MissileTurretMount,
	ShipClass,
	ShipSpec,
	TurretMount,
} from './specs';
export { SHIP_SPECS, emptyLoadoutAuxSlots, emptyLoadoutPairs } from './specs';

export type { BeamMountBuild, EngineMount, MainGunMountBuild, ShipMaterials } from './mounts';
export {
	attachEnginePlume,
	buildAuxMountGroup,
	buildAuxSystemVisual,
	buildBeamMountGroup,
	buildEmptyMountGroup,
	buildMainGunBeamGroup,
	buildMissileMountGroup,
	buildTurretMountGroup,
	createEngineMaterial,
	engineSize,
	mainGunBeamFromMount,
	pairDirection,
	pairMidpoint,
} from './mounts';

export type { BuiltShip } from './ship';
export { createShipGroup } from './ship';

export {
	applyCarrierLoadout,
	beamTurretFromMount,
	buildCarrierLoadoutVisual,
	cannonTurretFromMount,
	missileTurretFromMount,
	pdTurretFromMount,
	railgunTurretFromMount,
	spawnShipTurrets,
	turretFromMount,
} from './turrets';

export type { BuiltEnemy } from './enemy';
export { enemyShipGroup } from './enemy';

export type { BuiltMissile } from './projectiles';
export { buildMissile, cannonShellMesh, pdMesh, projectileMesh, railgunMesh } from './projectiles';

export type { BuiltVfx } from './meshVfx';
export {
	createBlast,
	createExplosionMesh,
	createImpactSparkMesh,
	createMuzzleFlashMesh,
	pickupMesh,
} from './meshVfx';
