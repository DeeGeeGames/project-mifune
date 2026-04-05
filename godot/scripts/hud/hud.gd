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

	game_over_overlay.visible = false
	_update_stats()
	_update_instructions()

func _process(_delta: float) -> void:
	_update_stats()
	_update_instructions()

func _update_stats() -> void:
	defense_label.text = "Defense: %d/%d" % [GameManager.defense_hp, Constants.DEFENSE_HP]
	var wave_status: String = " (intermission)" if GameManager.between_waves else ""
	wave_label.text = "Wave: %d%s" % [GameManager.wave_number, wave_status]

	var turret_count: int = GameManager.turrets_container.get_child_count() if is_instance_valid(GameManager.turrets_container) else 0
	turret_label.text = "Turrets: %d" % turret_count

	var mode_str: String
	match GameManager.control_mode["tag"]:
		"all":
			mode_str = "ALL"
		"single":
			mode_str = "SINGLE"
		_:
			mode_str = "AUTO"
	control_label.text = "Control: %s" % mode_str

	currency_label.text = "Currency: $%d" % GameManager.currency

	var runner_count: int = GameManager.runners_container.get_child_count() if is_instance_valid(GameManager.runners_container) else 0
	runner_label.text = "Runners: %d/%d" % [runner_count, Constants.MAX_RUNNERS]
	priority_label.text = "Priority: %s (P)" % GameManager.runner_priority.to_upper()

func _update_instructions() -> void:
	var ps: Dictionary[String, Variant] = GameManager.placement_state
	match ps["tag"]:
		"placing_turret":
			instruction_label.text = "Click to place turret | ESC to cancel"
		"aiming":
			instruction_label.text = "Click to confirm arc | Scroll to adjust width | ESC to cancel"
		"placing_block":
			instruction_label.text = "Click to place block | ESC to cancel"
		_:
			if GameManager.control_mode["tag"] != "none":
				instruction_label.text = "LMB: fire | T: release all | ESC: release"
			else:
				instruction_label.text = "T: control all | Click turret: control one | R: buy runner | P: toggle priority"

func _on_game_over() -> void:
	game_over_overlay.visible = true
