extends Node

const SPAWN_REGION_SCENE: PackedScene = preload("res://scenes/entities/spawn_region.tscn")

var regions_to_spawn: int = 0
var region_spawn_timer: float = 0.0
var between_waves: bool = false
var intermission_timer: float = 0.0

@onready var regions_container: Node2D = get_node("/root/Main/World/SpawnRegions")

func _ready() -> void:
	_start_wave(Constants.STARTING_WAVE)

func _start_wave(wave_num: int) -> void:
	GameManager.wave_number = wave_num
	regions_to_spawn = Constants.WAVE_REGIONS_BASE + wave_num
	region_spawn_timer = 0.0
	between_waves = false
	intermission_timer = 0.0
	GameManager.wave_started.emit(wave_num)

func _process(delta: float) -> void:
	if GameManager.game_over:
		return
	_tick_waves(delta)

func _tick_waves(delta: float) -> void:
	if between_waves:
		intermission_timer -= delta
		if intermission_timer <= 0.0:
			_start_wave(GameManager.wave_number + 1)
		return

	var active_regions: int = get_tree().get_nodes_in_group("regions").size()
	var active_enemies: int = get_tree().get_nodes_in_group("enemies").size()

	if regions_to_spawn <= 0 and active_regions == 0 and active_enemies == 0:
		between_waves = true
		intermission_timer = Constants.WAVE_INTERMISSION
		GameManager.wave_cleared.emit()
		return

	if regions_to_spawn <= 0:
		return
	if active_regions >= Constants.WAVE_MAX_CONCURRENT_REGIONS:
		return

	region_spawn_timer -= delta
	if region_spawn_timer > 0.0:
		return

	_spawn_region()
	regions_to_spawn -= 1
	region_spawn_timer = Constants.WAVE_REGION_SPAWN_INTERVAL

func _spawn_region() -> void:
	var pos: Vector2 = _random_region_position()
	var region: SpawnRegion = SPAWN_REGION_SCENE.instantiate()
	region.position = pos
	region.initialize(GameManager.wave_number)
	regions_container.add_child(region)

func _random_region_position() -> Vector2:
	for i: int in Constants.REGION_MAX_PLACEMENT_ATTEMPTS:
		var x: float = Constants.REGION_MARGIN + randf() * (Constants.WORLD_WIDTH - Constants.REGION_MARGIN * 2.0)
		var y: float = Constants.REGION_MARGIN + randf() * (Constants.GROUND_Y - Constants.REGION_MARGIN * 2.0)
		var offset: Vector2 = Vector2(x, y) - Constants.TARGET_POS
		if offset.length_squared() > Constants.REGION_SAFE_RADIUS * Constants.REGION_SAFE_RADIUS:
			return Vector2(x, y)
	return Vector2(Constants.REGION_MARGIN, Constants.REGION_MARGIN)
