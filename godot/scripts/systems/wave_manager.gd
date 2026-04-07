extends Node

var regions_to_spawn: int = 0
var walker_regions_to_spawn: int = 0
var between_waves: bool = false

# Live counters maintained via signal-driven spawn/despawn callbacks from
# main.gd. Replaces per-frame `get_nodes_in_group("regions")` polling.
var active_regions: int = 0
var active_enemies: int = 0

@onready var region_spawn_timer: Timer = $RegionSpawnTimer

func _ready() -> void:
	region_spawn_timer.one_shot = true
	region_spawn_timer.timeout.connect(_on_region_spawn_timeout)
	_start_wave(Constants.STARTING_WAVE)

func _start_wave(wave_num: int) -> void:
	GameManager.set_wave_number(wave_num)
	var total_regions: int = Constants.WAVE_REGIONS_BASE + wave_num
	# Truncating int division is intentional — ~1/3 of regions become walkers.
	@warning_ignore("integer_division")
	var walker_share: int = total_regions / 3
	walker_regions_to_spawn = maxi(1, walker_share)
	regions_to_spawn = total_regions - walker_regions_to_spawn
	between_waves = false
	region_spawn_timer.stop()
	_check_wave_state()

# --- Spawn/despawn counters (called from main.gd) ---
func on_region_spawned() -> void:
	active_regions += 1

func on_region_despawned() -> void:
	active_regions -= 1
	# On scene shutdown, enemies' tree_exiting can fire after WaveManager has
	# already left the tree — skip work in that case.
	if is_inside_tree():
		_check_wave_state()

func on_enemy_spawned() -> void:
	active_enemies += 1

func on_enemy_despawned() -> void:
	active_enemies -= 1
	if is_inside_tree():
		_check_wave_state()

# --- State machine ---
func _check_wave_state() -> void:
	if between_waves:
		return

	if regions_to_spawn > 0 or walker_regions_to_spawn > 0:
		_try_spawn_next_region()
		return

	if active_regions == 0 and active_enemies == 0:
		between_waves = true
		GameManager.emit_wave_cleared()
		_start_intermission()

func _try_spawn_next_region() -> void:
	if active_regions >= Constants.WAVE_MAX_CONCURRENT_REGIONS:
		return
	if not region_spawn_timer.is_stopped():
		return
	region_spawn_timer.start(Constants.WAVE_REGION_SPAWN_INTERVAL)

func _on_region_spawn_timeout() -> void:
	var total_remaining: int = regions_to_spawn + walker_regions_to_spawn
	if total_remaining <= 0:
		return

	# Pick type based on remaining counts
	var spawn_walker: bool = false
	if regions_to_spawn <= 0:
		spawn_walker = true
	elif walker_regions_to_spawn > 0:
		spawn_walker = randi() % total_remaining < walker_regions_to_spawn

	if spawn_walker:
		var pos: Vector2 = _random_position_in_range(Constants.WALKER_REGION_MIN_Y, Constants.WALKER_REGION_MAX_Y)
		GameManager.request_walker_region_spawn(pos, GameManager.wave_number)
		walker_regions_to_spawn -= 1
	else:
		var pos: Vector2 = _random_position_in_range(Constants.REGION_MARGIN, Constants.GROUND_Y - Constants.REGION_MARGIN * 2.0)
		GameManager.request_region_spawn(pos, GameManager.wave_number)
		regions_to_spawn -= 1

	# Try queueing the next one immediately — _check_wave_state respects the
	# concurrent cap and the timer's cooldown.
	_check_wave_state()

func _start_intermission() -> void:
	await get_tree().create_timer(Constants.WAVE_INTERMISSION).timeout
	_start_wave(GameManager.wave_number + 1)

func _x_exclusion_half(wave_num: int) -> float:
	var ratio: float = maxf(
		Constants.REGION_X_EXCLUSION_RATIO - wave_num * Constants.REGION_X_EXCLUSION_SHRINK_PER_WAVE,
		Constants.REGION_X_EXCLUSION_MIN_RATIO,
	)
	return Constants.WORLD_WIDTH * ratio

func _random_position_in_range(y_min: float, y_max: float) -> Vector2:
	var exclusion_half: float = _x_exclusion_half(GameManager.wave_number)
	for i: int in Constants.REGION_MAX_PLACEMENT_ATTEMPTS:
		var x: float = Constants.REGION_MARGIN + randf() * (Constants.WORLD_WIDTH - Constants.REGION_MARGIN * 2.0)
		var y: float = y_min + randf() * (y_max - y_min)
		var offset: Vector2 = Vector2(x, y) - Constants.TARGET_POS
		if offset.length_squared() <= Constants.REGION_SAFE_RADIUS * Constants.REGION_SAFE_RADIUS:
			continue
		if absf(x - Constants.TARGET_X) < exclusion_half:
			continue
		return Vector2(x, y)
	return Vector2(Constants.REGION_MARGIN, y_min)
