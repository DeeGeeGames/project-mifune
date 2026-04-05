extends VBoxContainer

@onready var turret_button: Button = $TurretButton
@onready var block_button: Button = $BlockButton
@onready var runner_button: Button = $RunnerButton

func _ready() -> void:
	turret_button.pressed.connect(_on_turret_pressed)
	block_button.pressed.connect(_on_block_pressed)
	runner_button.pressed.connect(_on_runner_pressed)

func _process(_delta: float) -> void:
	_update_button_states()

func _update_button_states() -> void:
	var ps: Dictionary[String, Variant] = GameManager.placement_state
	var cm: Dictionary[String, Variant] = GameManager.control_mode

	# Turret button
	var turret_enabled: bool = GameManager.currency >= Constants.TURRET_COST and cm["tag"] == "none"
	var turret_active: bool = ps["tag"] == "placing_turret" or ps["tag"] == "aiming"
	turret_button.disabled = not turret_enabled and not turret_active
	turret_button.text = "Turret  $%d" % Constants.TURRET_COST
	if turret_active:
		turret_button.add_theme_color_override("font_color", Color(0.0, 1.0, 1.0))
	else:
		turret_button.remove_theme_color_override("font_color")

	# Block button
	var block_enabled: bool = GameManager.currency >= Constants.BLOCK_COST and cm["tag"] == "none"
	var block_active: bool = ps["tag"] == "placing_block"
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
	if GameManager.control_mode["tag"] != "none":
		return
	if GameManager.currency < Constants.TURRET_COST:
		return
	var ps: Dictionary[String, Variant] = GameManager.placement_state
	if ps["tag"] == "placing_turret" or ps["tag"] == "aiming":
		GameManager.set_placement_state({ "tag": "idle" })
	else:
		GameManager.set_placement_state({ "tag": "placing_turret" })

func _on_block_pressed() -> void:
	if GameManager.control_mode["tag"] != "none":
		return
	if GameManager.currency < Constants.BLOCK_COST:
		return
	var ps: Dictionary[String, Variant] = GameManager.placement_state
	if ps["tag"] == "placing_block":
		GameManager.set_placement_state({ "tag": "idle" })
	else:
		GameManager.set_placement_state({ "tag": "placing_block" })

func _on_runner_pressed() -> void:
	GameManager.try_buy_runner()
