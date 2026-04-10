extends Defender
class_name Turret

@export var config: TurretConfig = preload("res://resources/defaults/turret_default.tres")

var aim_angle: float = -PI / 2.0
var arc_center: float = Constants.ARC_RANGE_CENTER
var arc_width: float = Constants.ARC_WIDTH_DEFAULT
var arc_range_center: float = Constants.GROUND_ARC_RANGE_CENTER
var arc_range_width: float = Constants.GROUND_ARC_RANGE_WIDTH
var parent_block_id: int = -1
var is_controlled_cache: bool = false
var _prev_aim_angle: float = -PI / 2.0
var _prev_controlled: bool = false

@onready var click_area: Area2D = $ClickArea

func _ready() -> void:
	max_ammo = config.max_ammo
	reload_threshold = config.reload_threshold
	fire_rate = config.fire_rate
	barrel_length = config.barrel_length
	spread = config.spread
	super._ready()
	add_to_group("turrets")
	range_area.tracking_range = config.attack_range
	($ClickArea/ClickShape.shape as CircleShape2D).radius = config.radius
	click_area.input_event.connect(_on_click_area_input)
	tree_exiting.connect(GameManager.turret_count_changed.emit)
	GameManager.turret_count_changed.emit()

func initialize(pos: Vector2, p_arc_center: float, p_arc_width: float, p_arc_range_center: float, p_arc_range_width: float, p_parent_block_id: int = -1) -> void:
	position = pos
	arc_center = p_arc_center
	arc_width = p_arc_width
	arc_range_center = p_arc_range_center
	arc_range_width = p_arc_range_width
	aim_angle = p_arc_center
	parent_block_id = p_parent_block_id

func _on_click_area_input(_viewport: Node, event: InputEvent, _shape_idx: int) -> void:
	if not (event is InputEventMouseButton):
		return
	var mb: InputEventMouseButton = event as InputEventMouseButton
	if not mb.pressed or mb.button_index != MOUSE_BUTTON_LEFT:
		return
	if GameManager.placement_state != GameManagerClass.PlacementState.IDLE:
		return
	if GameManager.control_mode != GameManagerClass.ControlMode.NONE:
		return
	GameManager.set_control_mode(GameManagerClass.ControlMode.SINGLE, get_instance_id())
	get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
	var max_rotation: float = config.turn_speed * delta
	is_controlled_cache = _is_controlled()

	if is_controlled_cache:
		_tick_controlled(max_rotation)
	else:
		_tick_autonomous(max_rotation)

	var needs_redraw: bool = not is_equal_approx(aim_angle, _prev_aim_angle) or is_controlled_cache != _prev_controlled or ammo != _prev_ammo
	_prev_aim_angle = aim_angle
	_prev_controlled = is_controlled_cache
	_prev_ammo = ammo
	if needs_redraw:
		queue_redraw()

func _is_controlled() -> bool:
	var mode: GameManagerClass.ControlMode = GameManager.control_mode
	var controlled: bool = mode == GameManagerClass.ControlMode.ALL or (mode == GameManagerClass.ControlMode.SINGLE and GameManager.controlled_turret_id == get_instance_id())
	if not controlled:
		return false
	var mouse_angle: float = Targeting.aim_angle(global_position, get_global_mouse_position())
	return Targeting.is_angle_in_arc(mouse_angle, arc_range_center, arc_range_width)

func _tick_controlled(max_rotation: float) -> void:
	var target_angle: float = Targeting.aim_angle(global_position, get_global_mouse_position())
	aim_angle = Targeting.rotate_toward(aim_angle, target_angle, max_rotation)

	if Input.is_action_pressed("fire"):
		_try_fire(aim_angle)

func _tick_autonomous(max_rotation: float) -> void:
	var target_enemy: EnemyBase = _find_nearest_enemy_in_arc()

	if target_enemy == null:
		aim_angle = Targeting.rotate_toward(aim_angle, arc_center, max_rotation)
		return

	var lead_pos: Vector2 = Targeting.lead_target(
		global_position,
		target_enemy.global_position,
		target_enemy.get_velocity_for_targeting(),
		Constants.BULLET_SPEED,
	)
	var target_angle: float = Targeting.aim_angle(global_position, lead_pos)
	target_angle = Targeting.clamp_angle_to_arc(target_angle, arc_center, arc_width)
	aim_angle = Targeting.rotate_toward(aim_angle, target_angle, max_rotation)

	_try_fire(aim_angle)

func _find_nearest_enemy_in_arc() -> EnemyBase:
	var nearest: EnemyBase = null
	var nearest_dist: float = config.attack_range

	for enemy: EnemyBase in range_area.bodies_in_range:
		var angle: float = Targeting.aim_angle(global_position, enemy.global_position)
		if not Targeting.is_angle_in_arc(angle, arc_center, arc_width):
			continue
		var dist: float = global_position.distance_to(enemy.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = enemy

	return nearest

func _draw() -> void:
	var body_color: Color = Color(0.0, 1.0, 1.0) if is_controlled_cache else Color(0.0, 0.8, 0.0)
	draw_circle(Vector2.ZERO, config.radius, body_color)

	var barrel_end: Vector2 = Vector2.from_angle(aim_angle) * config.barrel_length
	draw_line(Vector2.ZERO, barrel_end, body_color, 3.0)

	var ratio: float = float(ammo) / float(config.max_ammo)
	var ammo_color: Color = Color(0.0, 1.0, 0.0) if ratio > 0.5 else (Color(1.0, 1.0, 0.0) if ratio > 0.25 else Color(1.0, 0.0, 0.0))
	DrawUtils.draw_bar(self, 0.0, config.radius + 4.0, config.radius * 2.0, 3.0, ratio, ammo_color)

	if is_controlled_cache:
		draw_arc(Vector2.ZERO, config.attack_range, 0, TAU, 64, Color(0.0, 1.0, 1.0, 0.15), 1.0)
		DrawUtils.draw_arc_wedge(self, Vector2.ZERO, config.attack_range, arc_center, arc_width, Color(0.0, 1.0, 1.0, 0.1), 16)
