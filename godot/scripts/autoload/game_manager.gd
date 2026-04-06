extends Node
# class_name enables static type checking on GameManager.method() calls across the project.
# Without it, Godot types the autoload global as Node and can't verify methods at parse time.
# The *Class suffix avoids name collision with the autoload instance name "GameManager".
class_name GameManagerClass

enum ControlMode { NONE, ALL, SINGLE }
enum PlacementState { IDLE, PLACING_TURRET, AIMING, PLACING_BLOCK, PLACING_SOLDIER }
enum RunnerPriority { RESOURCES, AMMO }

# --- Signals ---
signal currency_changed(new_amount: int)
signal defense_damaged(new_hp: int)
signal game_over_triggered
signal wave_started(wave_number: int)
signal wave_cleared
signal control_mode_changed(mode: ControlMode)
signal runner_priority_changed(priority: RunnerPriority)
signal placement_state_changed(state: PlacementState)
signal runner_purchased
signal region_spawn_requested(pos: Vector2, wave_number: int)
signal walker_region_spawn_requested(pos: Vector2, wave_number: int)

# --- State ---
var currency: int = Constants.STARTING_CURRENCY
var wave_number: int = Constants.STARTING_WAVE
var defense_hp: int = Constants.DEFENSE_HP
var game_over: bool = false

# Control mode
var control_mode: ControlMode = ControlMode.NONE
var controlled_turret_id: int = -1

# Runner priority
var runner_priority: RunnerPriority = RunnerPriority.RESOURCES

# Placement state
var placement_state: PlacementState = PlacementState.IDLE
var aiming_position: Vector2 = Vector2.ZERO
var aiming_arc_width: float = 0.0
var aiming_arc_range_center: float = 0.0
var aiming_arc_range_width: float = 0.0
var aiming_parent_block_id: int = -1

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
		get_tree().paused = true

# --- Control mode ---
func set_control_mode(mode: ControlMode, turret_id: int = -1) -> void:
	control_mode = mode
	controlled_turret_id = turret_id
	control_mode_changed.emit(mode)

func toggle_control_all() -> void:
	if control_mode == ControlMode.ALL:
		set_control_mode(ControlMode.NONE)
	else:
		set_control_mode(ControlMode.ALL)

func release_control() -> void:
	set_control_mode(ControlMode.NONE)

# --- Runner priority ---
func toggle_runner_priority() -> void:
	runner_priority = RunnerPriority.AMMO if runner_priority == RunnerPriority.RESOURCES else RunnerPriority.RESOURCES
	runner_priority_changed.emit(runner_priority)

# --- Placement state ---
func set_placement_state(state: PlacementState) -> void:
	placement_state = state
	placement_state_changed.emit(state)

func enter_aiming(pos: Vector2, arc_width: float, arc_range_center: float, arc_range_width: float, parent_block_id: int) -> void:
	aiming_position = pos
	aiming_arc_width = arc_width
	aiming_arc_range_center = arc_range_center
	aiming_arc_range_width = arc_range_width
	aiming_parent_block_id = parent_block_id
	placement_state = PlacementState.AIMING
	placement_state_changed.emit(PlacementState.AIMING)

func set_aiming_arc_width(width: float) -> void:
	if is_equal_approx(aiming_arc_width, width):
		return
	aiming_arc_width = width
	placement_state_changed.emit(PlacementState.AIMING)

# --- Input (global hotkeys) ---
func _unhandled_input(event: InputEvent) -> void:
	if game_over:
		return

	if event.is_action_pressed("toggle_control"):
		if placement_state != PlacementState.IDLE:
			set_placement_state(PlacementState.IDLE)
		else:
			toggle_control_all()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("cancel"):
		if placement_state != PlacementState.IDLE:
			set_placement_state(PlacementState.IDLE)
		else:
			release_control()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("toggle_priority"):
		toggle_runner_priority()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("buy_runner"):
		try_buy_runner()
		get_viewport().set_input_as_handled()

func try_buy_runner() -> void:
	if get_tree().get_nodes_in_group("runners").size() >= Constants.MAX_RUNNERS:
		return
	if not spend_currency(Constants.RUNNER_COST):
		return
	runner_purchased.emit()
