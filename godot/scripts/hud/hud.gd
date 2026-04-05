extends CanvasLayer

@onready var stats_panel: VBoxContainer = $StatsPanel
@onready var defense_label: Label = $StatsPanel/DefenseLabel
@onready var wave_label: Label = $StatsPanel/WaveLabel
@onready var turret_label: Label = $StatsPanel/TurretLabel
@onready var control_label: Label = $StatsPanel/ControlLabel
@onready var currency_label: Label = $StatsPanel/CurrencyLabel
@onready var runner_label: Label = $StatsPanel/RunnerLabel
@onready var priority_label: Label = $StatsPanel/PriorityLabel
@onready var instruction_label: Label = $InstructionLabel
@onready var build_menu: VBoxContainer = $BuildMenu
@onready var game_over_overlay: ColorRect = $GameOverOverlay

func _ready() -> void:
	GameManager.game_over_triggered.connect(_on_game_over)
	GameManager.currency_changed.connect(_on_currency_changed)
	GameManager.defense_damaged.connect(_on_defense_damaged)
	GameManager.wave_started.connect(_on_wave_started)
	GameManager.wave_cleared.connect(_on_wave_cleared)
	GameManager.control_mode_changed.connect(_on_control_mode_changed)
	GameManager.placement_state_changed.connect(_on_placement_state_changed)
	GameManager.runner_priority_changed.connect(_on_runner_priority_changed)
	get_tree().node_added.connect(_on_tree_changed)
	get_tree().node_removed.connect(_on_tree_changed)

	game_over_overlay.visible = false
	_update_all()

func _update_all() -> void:
	_update_defense_label()
	_update_wave_label()
	_update_turret_count()
	_update_control_label()
	_update_currency_label()
	_update_runner_count()
	_update_priority_label()
	_update_instructions()

func _on_currency_changed(_new_amount: int) -> void:
	_update_currency_label()

func _on_defense_damaged(_new_hp: int) -> void:
	_update_defense_label()

func _on_wave_started(wave_num: int) -> void:
	wave_label.text = "Wave: %d" % wave_num

func _on_control_mode_changed(_mode: GameManagerClass.ControlMode) -> void:
	_update_control_label()
	_update_instructions()

func _on_placement_state_changed(_state: GameManagerClass.PlacementState) -> void:
	_update_instructions()

func _on_runner_priority_changed(_priority: GameManagerClass.RunnerPriority) -> void:
	_update_priority_label()

func _on_tree_changed(_node: Node) -> void:
	_update_turret_count.call_deferred()
	_update_runner_count.call_deferred()

func _update_defense_label() -> void:
	defense_label.text = "Defense: %d/%d" % [GameManager.defense_hp, Constants.DEFENSE_HP]

func _update_wave_label() -> void:
	wave_label.text = "Wave: %d" % GameManager.wave_number

func _on_wave_cleared() -> void:
	wave_label.text = "Wave: %d (intermission)" % GameManager.wave_number

func _update_turret_count() -> void:
	var turret_count: int = get_tree().get_nodes_in_group("turrets").size()
	turret_label.text = "Turrets: %d" % turret_count

func _update_control_label() -> void:
	var mode_str: String
	match GameManager.control_mode:
		GameManagerClass.ControlMode.ALL:
			mode_str = "ALL"
		GameManagerClass.ControlMode.SINGLE:
			mode_str = "SINGLE"
		_:
			mode_str = "AUTO"
	control_label.text = "Control: %s" % mode_str

func _update_currency_label() -> void:
	currency_label.text = "Currency: $%d" % GameManager.currency

func _update_runner_count() -> void:
	var runner_count: int = get_tree().get_nodes_in_group("runners").size()
	runner_label.text = "Runners: %d/%d" % [runner_count, Constants.MAX_RUNNERS]

func _update_priority_label() -> void:
	var priority_str: String
	match GameManager.runner_priority:
		GameManagerClass.RunnerPriority.AMMO:
			priority_str = "AMMO"
		_:
			priority_str = "RESOURCES"
	priority_label.text = "Priority: %s (P)" % priority_str

func _update_instructions() -> void:
	match GameManager.placement_state:
		GameManagerClass.PlacementState.PLACING_TURRET:
			instruction_label.text = "Click to place turret | ESC to cancel"
		GameManagerClass.PlacementState.AIMING:
			instruction_label.text = "Click to confirm arc | Scroll to adjust width | ESC to cancel"
		GameManagerClass.PlacementState.PLACING_BLOCK:
			instruction_label.text = "Click to place block | ESC to cancel"
		_:
			if GameManager.control_mode != GameManagerClass.ControlMode.NONE:
				instruction_label.text = "LMB: fire | T: release all | ESC: release"
			else:
				instruction_label.text = "T: control all | Click turret: control one | R: buy runner | P: toggle priority"

func _on_game_over() -> void:
	game_over_overlay.visible = true
