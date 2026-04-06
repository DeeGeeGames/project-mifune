extends CharacterBody2D
class_name Soldier

signal fired(pos: Vector2, vel: Vector2)
signal died(pos: Vector2)

@export var config: SoldierConfig = preload("res://resources/defaults/soldier_default.tres")

var hp: int = 0
var ammo: int = 0
var aim_angle: float = 0.0
var arc_width: float = Constants.SOLDIER_ARC_WIDTH
var default_facing: float = 0.0
var can_fire: bool = true
var enemies_in_range: Array[CharacterBody2D] = []
var claimed_by_runner: Node2D = null
var _prev_aim_angle: float = 0.0
var _prev_ammo: int = 0
var _prev_hp: int = 0

@onready var range_area: Area2D = $RangeArea
@onready var hurt_area: Area2D = $HurtArea
@onready var fire_timer: Timer = $FireTimer

func _ready() -> void:
	hp = config.hp
	ammo = config.max_ammo
	_prev_ammo = ammo
	_prev_hp = hp
	add_to_group("soldiers")
	fire_timer.wait_time = 1.0 / config.fire_rate
	fire_timer.one_shot = true
	fire_timer.timeout.connect(_on_fire_timer_timeout)
	range_area.body_entered.connect(_on_range_body_entered)
	range_area.body_exited.connect(_on_range_body_exited)
	hurt_area.body_entered.connect(_on_hurt_area_body_entered)

func initialize(pos: Vector2, facing: float) -> void:
	position = pos
	default_facing = facing
	aim_angle = facing
	_prev_aim_angle = facing

func needs_ammo() -> bool:
	return ammo <= config.reload_threshold

func reload(amount: int) -> void:
	ammo = mini(config.max_ammo, ammo + amount)

func claim(runner: Node2D) -> void:
	claimed_by_runner = runner

func unclaim() -> void:
	claimed_by_runner = null

func is_claimed() -> bool:
	return claimed_by_runner != null

func take_damage(amount: int) -> void:
	hp -= amount
	if hp <= 0:
		_die()
		return
	queue_redraw()

func _die() -> void:
	died.emit(global_position)
	queue_free()

func _on_fire_timer_timeout() -> void:
	can_fire = true

func _on_range_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		enemies_in_range.append(body)

func _on_range_body_exited(body: Node2D) -> void:
	enemies_in_range.erase(body)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body is Enemy:
		var enemy: Enemy = body as Enemy
		var damage: int = enemy.get_hp()
		enemy.die(true)
		take_damage(damage)

func _process(delta: float) -> void:
	enemies_in_range = enemies_in_range.filter(func(e: CharacterBody2D) -> bool: return is_instance_valid(e))
	if claimed_by_runner != null and not is_instance_valid(claimed_by_runner):
		claimed_by_runner = null

	var max_rotation: float = config.turn_speed * delta
	_tick_autonomous(max_rotation)

	var needs_redraw: bool = not is_equal_approx(aim_angle, _prev_aim_angle) or ammo != _prev_ammo or hp != _prev_hp
	_prev_aim_angle = aim_angle
	_prev_ammo = ammo
	_prev_hp = hp
	if needs_redraw:
		queue_redraw()

func _tick_autonomous(max_rotation: float) -> void:
	var nearest: CharacterBody2D = null
	var nearest_dist: float = config.range
	var nearest_arc_center: float = default_facing

	for enemy: CharacterBody2D in enemies_in_range:
		var angle: float = Targeting.aim_angle(global_position, enemy.global_position)
		var enemy_arc_center: float
		if Targeting.is_angle_in_arc(angle, default_facing, arc_width):
			enemy_arc_center = default_facing
		elif Targeting.is_angle_in_arc(angle, default_facing + PI, arc_width):
			enemy_arc_center = default_facing + PI
		else:
			continue
		var dist: float = global_position.distance_to(enemy.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = enemy
			nearest_arc_center = enemy_arc_center

	if nearest == null:
		aim_angle = Targeting.rotate_toward(aim_angle, default_facing, max_rotation)
		return

	var enemy_vel: Vector2 = nearest.get_velocity_for_targeting() if nearest.has_method("get_velocity_for_targeting") else Vector2.ZERO
	var lead_pos: Vector2 = Targeting.lead_target(
		global_position,
		nearest.global_position,
		enemy_vel,
		Constants.BULLET_SPEED,
	)
	var target_angle: float = Targeting.aim_angle(global_position, lead_pos)
	target_angle = Targeting.clamp_angle_to_arc(target_angle, nearest_arc_center, arc_width)
	aim_angle = Targeting.rotate_toward(aim_angle, target_angle, max_rotation)

	# Hold fire while slewing across the front/back boundary — aim_angle may
	# briefly sit outside the active arc until rotate_toward catches up.
	if Targeting.is_angle_in_arc(aim_angle, nearest_arc_center, arc_width):
		_try_fire()

func _try_fire() -> void:
	if not can_fire or ammo <= 0:
		return

	ammo -= 1
	can_fire = false
	fire_timer.start()

	var barrel_tip: Vector2 = global_position + Vector2(cos(aim_angle), sin(aim_angle)) * config.barrel_length
	var spread_angle: float = aim_angle + (randf() - 0.5) * config.spread * 2.0
	var bullet_vel: Vector2 = Vector2(cos(spread_angle), sin(spread_angle)) * Constants.BULLET_SPEED

	fired.emit(barrel_tip, bullet_vel)

func _draw() -> void:
	var body_color: Color = Color(0.6, 0.4, 0.2)
	DrawUtils.draw_unit_body(self, Vector2.ZERO, config.radius, body_color)

	var barrel_end: Vector2 = Vector2(cos(aim_angle), sin(aim_angle)) * config.barrel_length
	draw_line(Vector2.ZERO, barrel_end, body_color, 3.0)

	var hp_ratio: float = float(hp) / float(config.hp)
	var hp_color: Color = Color(0.0, 1.0, 0.0) if hp_ratio > 0.5 else (Color(1.0, 1.0, 0.0) if hp_ratio > 0.25 else Color(1.0, 0.0, 0.0))
	DrawUtils.draw_bar(self, 0.0, -config.radius - 8.0, config.radius * 2.0, 3.0, hp_ratio, hp_color)

	var ammo_ratio: float = float(ammo) / float(config.max_ammo)
	var ammo_color: Color = Color(0.0, 1.0, 0.0) if ammo_ratio > 0.5 else (Color(1.0, 0.7, 0.0) if ammo_ratio > 0.25 else Color(1.0, 0.0, 0.0))
	DrawUtils.draw_bar(self, 0.0, config.radius + 4.0, config.radius * 2.0, 3.0, ammo_ratio, ammo_color)
