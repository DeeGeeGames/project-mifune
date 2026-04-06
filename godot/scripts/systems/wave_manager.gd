extends Node

var regions_to_spawn: int = 0
var between_waves: bool = false

var region_spawn_timer: Timer

func _ready() -> void:
	region_spawn_timer = Timer.new()
	region_spawn_timer.one_shot = true
	region_spawn_timer.timeout.connect(_on_region_spawn_timeout)
	add_child(region_spawn_timer)

	_start_wave(Constants.STARTING_WAVE)

func _start_wave(wave_num: int) -> void:
	GameManager.wave_number = wave_num
	regions_to_spawn = Constants.WAVE_REGIONS_BASE + wave_num
	between_waves = false
	region_spawn_timer.stop()
	GameManager.wave_started.emit(wave_num)

func _process(_delta: float) -> void:
	if between_waves:
		return
	_check_wave_state()

func _check_wave_state() -> void:
	if regions_to_spawn > 0:
		_try_spawn_next_region()
		return

	var active_regions: int = get_tree().get_nodes_in_group("regions").size()
	var active_enemies: int = get_tree().get_nodes_in_group("enemies").size()

	if active_regions == 0 and active_enemies == 0:
		between_waves = true
		GameManager.wave_cleared.emit()
		_start_intermission()

func _try_spawn_next_region() -> void:
	var active_regions: int = get_tree().get_nodes_in_group("regions").size()
	if active_regions >= Constants.WAVE_MAX_CONCURRENT_REGIONS:
		return
	if not region_spawn_timer.is_stopped():
		return
	region_spawn_timer.start(Constants.WAVE_REGION_SPAWN_INTERVAL)

func _on_region_spawn_timeout() -> void:
	if regions_to_spawn <= 0:
		return
	var pos: Vector2 = _random_region_position()
	GameManager.region_spawn_requested.emit(pos, GameManager.wave_number)
	regions_to_spawn -= 1

func _start_intermission() -> void:
	await get_tree().create_timer(Constants.WAVE_INTERMISSION).timeout
	_start_wave(GameManager.wave_number + 1)

func _x_exclusion_half(wave_num: int) -> float:
	var ratio: float = maxf(
		Constants.REGION_X_EXCLUSION_RATIO - wave_num * Constants.REGION_X_EXCLUSION_SHRINK_PER_WAVE,
		Constants.REGION_X_EXCLUSION_MIN_RATIO,
	)
	return Constants.WORLD_WIDTH * ratio

func _random_region_position() -> Vector2:
	var exclusion_half: float = _x_exclusion_half(GameManager.wave_number)
	for i: int in Constants.REGION_MAX_PLACEMENT_ATTEMPTS:
		var x: float = Constants.REGION_MARGIN + randf() * (Constants.WORLD_WIDTH - Constants.REGION_MARGIN * 2.0)
		var y: float = Constants.REGION_MARGIN + randf() * (Constants.GROUND_Y - Constants.REGION_MARGIN * 2.0)
		var offset: Vector2 = Vector2(x, y) - Constants.TARGET_POS
		if offset.length_squared() <= Constants.REGION_SAFE_RADIUS * Constants.REGION_SAFE_RADIUS:
			continue
		if absf(x - Constants.TARGET_X) < exclusion_half:
			continue
		return Vector2(x, y)
	return Vector2(Constants.REGION_MARGIN, Constants.REGION_MARGIN)
