extends Node

# --- Signals ---
signal currency_changed(new_amount: int)
signal defense_damaged(new_hp: int)
signal game_over_triggered
signal wave_started(wave_number: int)
signal wave_cleared
signal control_mode_changed(mode: Dictionary[String, Variant])
signal runner_priority_changed(priority: String)
signal placement_state_changed(state: Dictionary[String, Variant])
signal runner_purchased
signal enemy_died(pos: Vector2)
signal block_destroyed(block_id: int)

# --- State ---
var currency: int = Constants.STARTING_CURRENCY
var wave_number: int = Constants.STARTING_WAVE
var defense_hp: int = Constants.DEFENSE_HP
var game_over: bool = false

# Control mode: { "tag": "none" } | { "tag": "all" } | { "tag": "single", "turret_id": int }
var control_mode: Dictionary[String, Variant] = { "tag": "none" }

# Runner priority: "resources" or "ammo"
var runner_priority: String = "resources"

# Placement state: { "tag": "idle" } | { "tag": "placing_turret" } | { "tag": "aiming", ... } | { "tag": "placing_block" }
var placement_state: Dictionary[String, Variant] = { "tag": "idle" }

# --- Wave state ---
var regions_to_spawn: int = 0
var region_spawn_timer: float = 0.0
var between_waves: bool = false
var intermission_timer: float = 0.0

# --- Node references (set by main.gd) ---
var enemies_container: Node2D = null
var regions_container: Node2D = null
var turrets_container: Node2D = null
var runners_container: Node2D = null
var bullets_container: Node2D = null
var resources_container: Node2D = null
var blocks_container: Node2D = null

# Preloaded scenes (set by main.gd)
var spawn_region_scene: PackedScene = null
var enemy_scene: PackedScene = null
var bullet_scene: PackedScene = null
var resource_scene: PackedScene = null
var runner_scene: PackedScene = null
var turret_scene: PackedScene = null
var block_scene: PackedScene = null

func _ready() -> void:
	_start_wave(Constants.STARTING_WAVE)

func _start_wave(wave_num: int) -> void:
	wave_number = wave_num
	regions_to_spawn = Constants.WAVE_REGIONS_BASE + wave_number
	region_spawn_timer = 0.0
	between_waves = false
	intermission_timer = 0.0
	wave_started.emit(wave_number)

func _process(delta: float) -> void:
	if game_over:
		return
	_tick_waves(delta)

func _tick_waves(delta: float) -> void:
	if not is_instance_valid(regions_container) or not is_instance_valid(enemies_container):
		return

	if between_waves:
		intermission_timer -= delta
		if intermission_timer <= 0.0:
			_start_wave(wave_number + 1)
		return

	var active_regions := regions_container.get_child_count()
	var active_enemies := enemies_container.get_child_count()

	if regions_to_spawn <= 0 and active_regions == 0 and active_enemies == 0:
		between_waves = true
		intermission_timer = Constants.WAVE_INTERMISSION
		wave_cleared.emit()
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
	if not is_instance_valid(spawn_region_scene) or not is_instance_valid(regions_container):
		return

	var pos := _random_region_position()
	var region: Node2D = spawn_region_scene.instantiate()
	region.position = pos
	region.initialize(wave_number)
	regions_container.add_child(region)

func _random_region_position() -> Vector2:
	for i: int in Constants.REGION_MAX_PLACEMENT_ATTEMPTS:
		var x := Constants.REGION_MARGIN + randf() * (Constants.WORLD_WIDTH - Constants.REGION_MARGIN * 2.0)
		var y := Constants.REGION_MARGIN + randf() * (Constants.GROUND_Y - Constants.REGION_MARGIN * 2.0)
		var offset := Vector2(x, y) - Constants.TARGET_POS
		if offset.length_squared() > Constants.REGION_SAFE_RADIUS * Constants.REGION_SAFE_RADIUS:
			return Vector2(x, y)
	return Vector2(Constants.REGION_MARGIN, Constants.REGION_MARGIN)

# --- Currency ---
func add_currency(amount: int) -> void:
	currency += amount
	currency_changed.emit(currency)

func spend_currency(amount: int) -> bool:
	if currency < amount:
		return false
	currency -= amount
	currency_changed.emit(currency)
	return true

# --- Defense ---
func damage_defense(amount: int) -> void:
	defense_hp = maxi(0, defense_hp - amount)
	defense_damaged.emit(defense_hp)
	if defense_hp <= 0:
		game_over = true
		game_over_triggered.emit()

# --- Control mode ---
func set_control_mode(mode: Dictionary[String, Variant]) -> void:
	control_mode = mode
	control_mode_changed.emit(mode)

func toggle_control_all() -> void:
	if control_mode["tag"] == "all":
		set_control_mode({ "tag": "none" })
	else:
		set_control_mode({ "tag": "all" })

func release_control() -> void:
	set_control_mode({ "tag": "none" })

# --- Runner priority ---
func toggle_runner_priority() -> void:
	runner_priority = "ammo" if runner_priority == "resources" else "resources"
	runner_priority_changed.emit(runner_priority)

# --- Placement state ---
func set_placement_state(state: Dictionary[String, Variant]) -> void:
	placement_state = state
	placement_state_changed.emit(state)

# --- Input (global hotkeys) ---
func _unhandled_input(event: InputEvent) -> void:
	if game_over:
		return

	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_T:
				if placement_state["tag"] != "idle":
					set_placement_state({ "tag": "idle" })
				else:
					toggle_control_all()
				get_viewport().set_input_as_handled()
			KEY_ESCAPE:
				if placement_state["tag"] != "idle":
					set_placement_state({ "tag": "idle" })
				else:
					release_control()
				get_viewport().set_input_as_handled()
			KEY_P:
				toggle_runner_priority()
				get_viewport().set_input_as_handled()
			KEY_R:
				try_buy_runner()
				get_viewport().set_input_as_handled()

func try_buy_runner() -> void:
	if not is_instance_valid(runners_container):
		return
	if runners_container.get_child_count() >= Constants.MAX_RUNNERS:
		return
	if not spend_currency(Constants.RUNNER_COST):
		return
	runner_purchased.emit()
