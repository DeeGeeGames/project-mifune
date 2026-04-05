extends Node
# class_name enables static type checking on GameManager.method() calls across the project.
# Without it, Godot types the autoload global as Node and can't verify methods at parse time.
# The *Class suffix avoids name collision with the autoload instance name "GameManager".
class_name GameManagerClass

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

	if event.is_action_pressed("toggle_control"):
		if placement_state["tag"] != "idle":
			set_placement_state({ "tag": "idle" })
		else:
			toggle_control_all()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("cancel"):
		if placement_state["tag"] != "idle":
			set_placement_state({ "tag": "idle" })
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
