extends Node
# See GameManagerClass for why autoloads get a class_name.
class_name ConstantsClass

# Viewport & World
const VIEWPORT_WIDTH := 1280.0
const VIEWPORT_HEIGHT := 720.0
const WORLD_WIDTH := VIEWPORT_WIDTH * 6  # 7680
const WORLD_HEIGHT := VIEWPORT_HEIGHT * 6  # 4320
const GROUND_Y := WORLD_HEIGHT - 140.0  # 4180

# Base / Target
const TARGET_X := WORLD_WIDTH / 2.0  # 3840
const TARGET_Y := GROUND_Y  # 4180
const TARGET_POS := Vector2(TARGET_X, TARGET_Y)
const TARGET_RADIUS := 40.0
const DEFENSE_HP := 10

# Turret
const TURRET_RANGE := 1200.0
const TURRET_FIRE_RATE := 12.0  # shots per second
const TURRET_FIRE_INTERVAL := 1.0 / TURRET_FIRE_RATE
const TURRET_RADIUS := 18.0
const TURRET_BARREL_LENGTH := 28.0
const TURRET_TURN_SPEED := PI / 2.0  # radians per second
const TURRET_SPREAD := 0.08  # radians per shot
const TURRET_MAX_AMMO := 1000
const TURRET_RELOAD_THRESHOLD := 500
const TURRET_HOVER_RADIUS := TURRET_RADIUS * 3.0

# Bullet
const BULLET_SPEED := 2400.0
const BULLET_DAMAGE := 1
const BULLET_RADIUS := 4.0
const BULLET_HIT_RADIUS := 16.0

# Walker Spawner placement
const WALKER_REGION_MIN_Y := GROUND_Y - 800.0
const WALKER_REGION_MAX_Y := GROUND_Y - 300.0

# Enemy
const ENEMY_SPEED := 150.0
const ENEMY_HP := 4
const ENEMY_RADIUS := 12.0
const ENEMY_SPAWN_BURST_SPEED := 1000.0
const ENEMY_MOMENTUM_DECAY := 1.0  # per second
const ENEMY_RUNNER_AGGRO_RANGE := 120.0

# Spawn Regions (wave scaling)
const REGION_BASE_LIFETIME := 2.0  # seconds (was 2000ms)
const REGION_LIFETIME_SCALING := 1.0  # seconds added per wave
const REGION_MAX_LIFETIME := 24.0  # seconds cap
const REGION_BASE_HP := 32
const REGION_HP_SCALING := 8
const REGION_BASE_RADIUS := 80.0
const REGION_RADIUS_SCALING := 4.0
const REGION_MAX_RADIUS := 150.0
const REGION_BASE_SPAWN_INTERVAL := 0.2  # seconds between enemy spawns
const REGION_SPAWN_INTERVAL_SCALING := 0.06  # seconds reduction per wave
const REGION_MIN_SPAWN_INTERVAL := 0.08
const REGION_BURST_ARC_WIDTH := PI / 4.0  # 45 degree momentum cone
const REGION_BURST_VALID_RANGE_CENTER := -PI / 2.0  # up
const REGION_BURST_VALID_RANGE_WIDTH := PI  # 180 degrees
const REGION_SAFE_RADIUS := 400.0
const REGION_X_EXCLUSION_RATIO := 0.25
const REGION_X_EXCLUSION_SHRINK_PER_WAVE := 0.01
const REGION_X_EXCLUSION_MIN_RATIO := 0.15
const REGION_MARGIN := 60.0
const REGION_MAX_PLACEMENT_ATTEMPTS := 20

# Waves
const WAVE_REGIONS_BASE := 1  # regions per wave = this + wave_number
const WAVE_REGION_SPAWN_INTERVAL := 2.5  # seconds between region spawns
const WAVE_MAX_CONCURRENT_REGIONS := 4
const WAVE_INTERMISSION := 4.0  # seconds between waves
const STARTING_WAVE := 1

# Placement
const PLACEMENT_MIN_X := 80.0
const PLACEMENT_MAX_X := WORLD_WIDTH - 80.0

# Coverage arc
const ARC_WIDTH_DEFAULT := PI  # 180 degrees
const ARC_WIDTH_MIN := PI / 6.0  # 30 degrees
const ARC_SCROLL_STEP := PI / 18.0  # 10 degrees per scroll tick

# Per-turret valid arc range (ground turrets = upper semicircle)
const ARC_RANGE_CENTER := -PI / 2.0  # up
const ARC_RANGE_WIDTH := PI  # 180 degrees total
const GROUND_ARC_RANGE_CENTER: float = ARC_RANGE_CENTER
const GROUND_ARC_RANGE_WIDTH: float = ARC_RANGE_WIDTH

# Block face arc ranges
const RIGHT_FACE_ARC_RANGE_CENTER: float = 0.0
const RIGHT_FACE_ARC_RANGE_WIDTH: float = PI
const LEFT_FACE_ARC_RANGE_CENTER: float = PI
const LEFT_FACE_ARC_RANGE_WIDTH: float = PI

# Blocks
const BLOCK_SIZE := 36.0
const BLOCK_HALF := BLOCK_SIZE / 2.0
const BLOCK_HP := 20
const BLOCK_COST := 10
const BLOCK_FACE_CLICK_THRESHOLD := 24.0

# Economy
const TURRET_COST := 50
const STARTING_CURRENCY := 200
const RESOURCE_DROP_VALUE := 10
const RUNNER_COST := 30

# Runners
const RUNNER_SPEED := 120.0
const RUNNER_HP := 1
const RUNNER_SIZE := 10.0
const STARTING_RUNNERS := 2
const MAX_RUNNERS := 20
const RUNNER_PICKUP_DISTANCE := 15.0
const RUNNER_BASE_ARRIVE_DISTANCE := 25.0
const RUNNER_RELOAD_AMOUNT := 500

# Soldiers
const SOLDIER_COST := 40
const MAX_SOLDIERS := 10
const SOLDIER_ARC_WIDTH := PI / 3.0
const SOLDIER_RADIUS := 14.0
const SOLDIER_BARREL_LENGTH := 20.0
const SOLDIER_RANGE := 400.0

# Camera
const ZOOM_MIN := maxf(VIEWPORT_WIDTH / WORLD_WIDTH, VIEWPORT_HEIGHT / WORLD_HEIGHT)
const ZOOM_MAX := 3.0
const ZOOM_STEP := 0.1
const PAN_SPEED := 500.0
const INITIAL_ZOOM := ZOOM_MAX * 0.15

# Collision layer bits (1-indexed in Godot, but bitmask is 0-indexed)
const LAYER_TERRAIN := 1
const LAYER_BASE := 2
const LAYER_BLOCKS := 3
const LAYER_ENEMIES := 4
const LAYER_BULLETS := 5
const LAYER_RESOURCES := 6
const LAYER_RUNNERS := 7
const LAYER_TURRET_RANGE := 8
