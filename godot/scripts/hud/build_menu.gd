extends VBoxContainer

@onready var turret_button: Button = $TurretButton
@onready var block_button: Button = $BlockButton
@onready var runner_button: Button = $RunnerButton

func _ready() -> void:
	turret_button.pressed.connect(_on_turret_pressed)
	block_button.pressed.connect(_on_block_pressed)
	runner_button.pressed.connect(_on_runner_pressed)
	GameManager.currency_changed.connect(func(_v: int) -> void: _update_button_states())
	GameManager.control_mode_changed.connect(func(_v: GameManagerClass.ControlMode) -> void: _update_button_states())
	GameManager.placement_state_changed.connect(func(_v: GameManagerClass.PlacementState) -> void: _update_button_states())
	get_tree().node_added.connect(func(_n: Node) -> void: _update_button_states.call_deferred())
	get_tree().node_removed.connect(func(_n: Node) -> void: _update_button_states.call_deferred())
	_update_button_states()

func _update_button_states() -> void:
	var ps: GameManagerClass.PlacementState = GameManager.placement_state
	var cm: GameManagerClass.ControlMode = GameManager.control_mode

	# Turret button
	var turret_enabled: bool = GameManager.currency >= Constants.TURRET_COST and cm == GameManagerClass.ControlMode.NONE
	var turret_active: bool = ps == GameManagerClass.PlacementState.PLACING_TURRET or ps == GameManagerClass.PlacementState.AIMING
	turret_button.disabled = not turret_enabled and not turret_active
	turret_button.text = "Turret  $%d" % Constants.TURRET_COST
	if turret_active:
		turret_button.add_theme_color_override("font_color", Color(0.0, 1.0, 1.0))
	else:
		turret_button.remove_theme_color_override("font_color")

	# Block button
	var block_enabled: bool = GameManager.currency >= Constants.BLOCK_COST and cm == GameManagerClass.ControlMode.NONE
	var block_active: bool = ps == GameManagerClass.PlacementState.PLACING_BLOCK
	block_button.disabled = not block_enabled and not block_active
	block_button.text = "Block  $%d" % Constants.BLOCK_COST
	if block_active:
		block_button.add_theme_color_override("font_color", Color(0.0, 1.0, 1.0))
	else:
		block_button.remove_theme_color_override("font_color")

	# Runner button
	var runner_count: int = get_tree().get_nodes_in_group("runners").size()
	var runner_enabled: bool = GameManager.currency >= Constants.RUNNER_COST and runner_count < Constants.MAX_RUNNERS
	runner_button.disabled = not runner_enabled
	runner_button.text = "Runner  $%d" % Constants.RUNNER_COST

func _on_turret_pressed() -> void:
	if GameManager.control_mode != GameManagerClass.ControlMode.NONE:
		return
	if GameManager.currency < Constants.TURRET_COST:
		return
	var ps: GameManagerClass.PlacementState = GameManager.placement_state
	if ps == GameManagerClass.PlacementState.PLACING_TURRET or ps == GameManagerClass.PlacementState.AIMING:
		GameManager.set_placement_state(GameManagerClass.PlacementState.IDLE)
	else:
		GameManager.set_placement_state(GameManagerClass.PlacementState.PLACING_TURRET)

func _on_block_pressed() -> void:
	if GameManager.control_mode != GameManagerClass.ControlMode.NONE:
		return
	if GameManager.currency < Constants.BLOCK_COST:
		return
	var ps: GameManagerClass.PlacementState = GameManager.placement_state
	if ps == GameManagerClass.PlacementState.PLACING_BLOCK:
		GameManager.set_placement_state(GameManagerClass.PlacementState.IDLE)
	else:
		GameManager.set_placement_state(GameManagerClass.PlacementState.PLACING_BLOCK)

func _on_runner_pressed() -> void:
	GameManager.try_buy_runner()
