extends Defender
class_name Soldier

@export var config: SoldierConfig = preload("res://resources/defaults/soldier_default.tres")

var hp: int = 0
var aim_angle: float = 0.0
var arc_width: float = Constants.SOLDIER_ARC_WIDTH
var default_facing: float = 0.0
var _prev_aim_angle: float = 0.0
var _prev_hp: int = 0

@onready var hurt_area: Area2D = $HurtArea

func _max_ammo() -> int:
	return config.max_ammo

func _reload_threshold() -> int:
	return config.reload_threshold

func _fire_rate() -> float:
	return config.fire_rate

func _barrel_length() -> float:
	return config.barrel_length

func _spread() -> float:
	return config.spread

func _ready() -> void:
	super._ready()
	hp = config.hp
	_prev_hp = hp
	add_to_group("soldiers")
	hurt_area.body_entered.connect(_on_hurt_area_body_entered)

func initialize(pos: Vector2, facing: float) -> void:
	position = pos
	default_facing = facing
	aim_angle = facing
	_prev_aim_angle = facing

func take_damage(amount: int) -> void:
	hp -= amount
	if hp <= 0:
		_die()
		return
	queue_redraw()

func _die() -> void:
	GameManager.request_resource_drop(global_position)
	queue_free()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body is EnemyBase:
		var enemy: EnemyBase = body as EnemyBase
		var damage: int = enemy.get_hp()
		enemy.die(true)
		take_damage(damage)

func _process(delta: float) -> void:
	var max_rotation: float = config.turn_speed * delta
	_tick_autonomous(max_rotation)

	var needs_redraw: bool = not is_equal_approx(aim_angle, _prev_aim_angle) or ammo != _prev_ammo or hp != _prev_hp
	_prev_aim_angle = aim_angle
	_prev_ammo = ammo
	_prev_hp = hp
	if needs_redraw:
		queue_redraw()

func _tick_autonomous(max_rotation: float) -> void:
	var nearest: EnemyBase = null
	var nearest_dist: float = config.attack_range
	var nearest_arc_center: float = default_facing

	for enemy: EnemyBase in enemies_in_range:
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

	var lead_pos: Vector2 = Targeting.lead_target(
		global_position,
		nearest.global_position,
		nearest.get_velocity_for_targeting(),
		Constants.BULLET_SPEED,
	)
	var target_angle: float = Targeting.aim_angle(global_position, lead_pos)
	target_angle = Targeting.clamp_angle_to_arc(target_angle, nearest_arc_center, arc_width)
	aim_angle = Targeting.rotate_toward(aim_angle, target_angle, max_rotation)

	# Hold fire while slewing across the front/back boundary — aim_angle may
	# briefly sit outside the active arc until rotate_toward catches up.
	if Targeting.is_angle_in_arc(aim_angle, nearest_arc_center, arc_width):
		_try_fire(aim_angle)

func _draw() -> void:
	var body_color: Color = Color(0.6, 0.4, 0.2)
	DrawUtils.draw_unit_body(self, Vector2.ZERO, config.radius, body_color)

	var barrel_end: Vector2 = Vector2.from_angle(aim_angle) * config.barrel_length
	draw_line(Vector2.ZERO, barrel_end, body_color, 3.0)

	var hp_ratio: float = float(hp) / float(config.hp)
	var hp_color: Color = Color(0.0, 1.0, 0.0) if hp_ratio > 0.5 else (Color(1.0, 1.0, 0.0) if hp_ratio > 0.25 else Color(1.0, 0.0, 0.0))
	DrawUtils.draw_bar(self, 0.0, -config.radius - 8.0, config.radius * 2.0, 3.0, hp_ratio, hp_color)

	var ammo_ratio: float = float(ammo) / float(config.max_ammo)
	var ammo_color: Color = Color(0.0, 1.0, 0.0) if ammo_ratio > 0.5 else (Color(1.0, 0.7, 0.0) if ammo_ratio > 0.25 else Color(1.0, 0.0, 0.0))
	DrawUtils.draw_bar(self, 0.0, config.radius + 4.0, config.radius * 2.0, 3.0, ammo_ratio, ammo_color)
