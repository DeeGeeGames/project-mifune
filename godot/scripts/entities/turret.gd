extends Node2D
class_name Turret

var aim_angle: float = -PI / 2.0
var ammo: int = Constants.TURRET_MAX_AMMO
var arc_center: float = Constants.ARC_RANGE_CENTER
var arc_width: float = Constants.ARC_WIDTH_DEFAULT
var arc_range: Dictionary[String, Variant] = Constants.GROUND_ARC_RANGE
var parent_block_id: int = -1
var can_fire: bool = true
var is_controlled_cache: bool = false
var enemies_in_range: Array[CharacterBody2D] = []

@onready var range_area: Area2D = $RangeArea
@onready var fire_timer: Timer = $FireTimer

func _ready() -> void:
	fire_timer.wait_time = Constants.TURRET_FIRE_INTERVAL
	fire_timer.one_shot = true
	fire_timer.timeout.connect(_on_fire_timer_timeout)

	range_area.collision_layer = 1 << (Constants.LAYER_TURRET_RANGE - 1)
	range_area.collision_mask = 1 << (Constants.LAYER_ENEMIES - 1)
	range_area.body_entered.connect(_on_range_body_entered)
	range_area.body_exited.connect(_on_range_body_exited)

func initialize(pos: Vector2, p_arc_center: float, p_arc_width: float, p_arc_range: Dictionary[String, Variant], p_parent_block_id: int = -1) -> void:
	position = pos
	arc_center = p_arc_center
	arc_width = p_arc_width
	arc_range = p_arc_range
	aim_angle = p_arc_center
	parent_block_id = p_parent_block_id

func get_parent_block_id() -> int:
	return parent_block_id

func reload(amount: int) -> void:
	ammo = mini(Constants.TURRET_MAX_AMMO, ammo + amount)

func needs_ammo() -> bool:
	return ammo <= Constants.TURRET_RELOAD_THRESHOLD

func _on_range_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		enemies_in_range.append(body)

func _on_range_body_exited(body: Node2D) -> void:
	enemies_in_range.erase(body)

func _on_fire_timer_timeout() -> void:
	can_fire = true

func _process(delta: float) -> void:
	# Clean up freed enemies
	enemies_in_range = enemies_in_range.filter(func(e: CharacterBody2D) -> bool: return is_instance_valid(e))

	var max_rotation: float = Constants.TURRET_TURN_SPEED * delta
	is_controlled_cache = _is_controlled()

	if is_controlled_cache:
		_tick_controlled(max_rotation)
	else:
		_tick_autonomous(max_rotation)

	queue_redraw()

func _is_controlled() -> bool:
	var mode: Dictionary[String, Variant] = GameManager.control_mode
	if mode["tag"] == "all":
		var mouse_pos: Vector2 = get_global_mouse_position()
		var mouse_angle: float = Targeting.aim_angle(global_position, mouse_pos)
		return Targeting.is_angle_in_arc(mouse_angle, arc_range["center"], arc_range["width"])
	if mode["tag"] == "single" and mode.has("turret_id") and mode["turret_id"] == get_instance_id():
		var mouse_pos: Vector2 = get_global_mouse_position()
		var mouse_angle: float = Targeting.aim_angle(global_position, mouse_pos)
		return Targeting.is_angle_in_arc(mouse_angle, arc_range["center"], arc_range["width"])
	return false

func _tick_controlled(max_rotation: float) -> void:
	var mouse_pos: Vector2 = get_global_mouse_position()
	var target_angle: float = Targeting.aim_angle(global_position, mouse_pos)
	aim_angle = Targeting.rotate_toward(aim_angle, target_angle, max_rotation)

	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		_try_fire()

func _tick_autonomous(max_rotation: float) -> void:
	var target_enemy: CharacterBody2D = _find_nearest_enemy_in_arc()

	if target_enemy == null:
		# Drift back to arc center
		aim_angle = Targeting.rotate_toward(aim_angle, arc_center, max_rotation)
		return

	var enemy_vel: Vector2 = (target_enemy as Enemy).get_velocity_for_targeting() if target_enemy is Enemy else Vector2.ZERO
	var lead_pos: Vector2 = Targeting.lead_target(
		global_position,
		target_enemy.global_position,
		enemy_vel,
		Constants.BULLET_SPEED,
	)
	var target_angle: float = Targeting.aim_angle(global_position, lead_pos)
	target_angle = Targeting.clamp_angle_to_arc(target_angle, arc_center, arc_width)
	aim_angle = Targeting.rotate_toward(aim_angle, target_angle, max_rotation)

	_try_fire()

func _find_nearest_enemy_in_arc() -> CharacterBody2D:
	var nearest: CharacterBody2D = null
	var nearest_dist: float = Constants.TURRET_RANGE

	for enemy: CharacterBody2D in enemies_in_range:
		var angle: float = Targeting.aim_angle(global_position, enemy.global_position)
		if not Targeting.is_angle_in_arc(angle, arc_center, arc_width):
			continue
		var dist: float = global_position.distance_to(enemy.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = enemy

	return nearest

func _try_fire() -> void:
	if not can_fire or ammo <= 0:
		return

	ammo -= 1
	can_fire = false
	fire_timer.start()

	# Spawn bullet at barrel tip
	var barrel_tip: Vector2 = global_position + Vector2(cos(aim_angle), sin(aim_angle)) * Constants.TURRET_BARREL_LENGTH

	# Apply spread
	var spread_angle: float = aim_angle + (randf() - 0.5) * Constants.TURRET_SPREAD * 2.0
	var bullet_vel: Vector2 = Vector2(cos(spread_angle), sin(spread_angle)) * Constants.BULLET_SPEED

	var bullet: Area2D = GameManager.bullet_scene.instantiate()
	bullet.initialize(barrel_tip, bullet_vel)
	GameManager.bullets_container.add_child(bullet)

func _draw() -> void:
	var body_color: Color = Color(0.0, 1.0, 1.0) if is_controlled_cache else Color(0.0, 0.8, 0.0)

	# Body circle
	draw_circle(Vector2.ZERO, Constants.TURRET_RADIUS, body_color)

	# Barrel
	var barrel_end: Vector2 = Vector2(cos(aim_angle), sin(aim_angle)) * Constants.TURRET_BARREL_LENGTH
	draw_line(Vector2.ZERO, barrel_end, body_color, 3.0)

	# Ammo bar
	var ratio: float = float(ammo) / float(Constants.TURRET_MAX_AMMO)
	var ammo_color: Color = Color(0.0, 1.0, 0.0) if ratio > 0.5 else (Color(1.0, 1.0, 0.0) if ratio > 0.25 else Color(1.0, 0.0, 0.0))
	DrawUtils.draw_bar(self, 0.0, Constants.TURRET_RADIUS + 4.0, Constants.TURRET_RADIUS * 2.0, 3.0, ratio, ammo_color)

	# Range ring when controlled
	if is_controlled_cache:
		draw_arc(Vector2.ZERO, Constants.TURRET_RANGE, 0, TAU, 64, Color(0.0, 1.0, 1.0, 0.15), 1.0)

	# Arc visualization
	_draw_arc_wedge()

func _draw_arc_wedge() -> void:
	if not is_controlled_cache:
		return
	DrawUtils.draw_arc_wedge(self, Vector2.ZERO, 60.0, arc_center, arc_width, Color(0.0, 1.0, 1.0, 0.1), 16)
