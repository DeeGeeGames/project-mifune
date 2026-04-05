extends CharacterBody2D
class_name Enemy

signal died(pos: Vector2)

@export var config: EnemyConfig = preload("res://resources/defaults/enemy_default.tres")

var hp: int = 0
var speed: float = 0.0
var spawn_momentum: Vector2 = Vector2.ZERO
var momentum_factor: float = 1.0
var base_velocity: Vector2 = Vector2.ZERO
var runners_in_range: Array[CharacterBody2D] = []

@onready var aggro_area: Area2D = $AggroArea

func _ready() -> void:
	hp = config.hp
	speed = config.speed
	add_to_group("enemies")
	aggro_area.body_entered.connect(_on_aggro_body_entered)
	aggro_area.body_exited.connect(_on_aggro_body_exited)

func initialize(pos: Vector2, momentum: Vector2) -> void:
	position = pos
	spawn_momentum = momentum
	momentum_factor = 1.0

func get_hp() -> int:
	return hp

func get_velocity_for_targeting() -> Vector2:
	return base_velocity

func take_damage(amount: int) -> void:
	hp -= amount
	if hp <= 0:
		die(true)
		return
	queue_redraw()

func die(drop_resource: bool) -> void:
	if drop_resource:
		died.emit(global_position)
	queue_free()

func _on_aggro_body_entered(body: Node2D) -> void:
	if body is Runner:
		runners_in_range.append(body)

func _on_aggro_body_exited(body: Node2D) -> void:
	runners_in_range.erase(body)

func _physics_process(delta: float) -> void:
	runners_in_range = runners_in_range.filter(func(r: CharacterBody2D) -> bool: return is_instance_valid(r))

	# Decay momentum
	momentum_factor = maxf(0.0, momentum_factor - config.momentum_decay * delta)

	# Find target (runner aggro or base)
	var target_pos: Vector2 = _find_target()
	base_velocity = Targeting.velocity_toward(global_position, target_pos, speed)

	# Blend homing with spawn momentum
	var move_vel: Vector2 = base_velocity * (1.0 - momentum_factor) + spawn_momentum * momentum_factor
	velocity = move_vel
	move_and_slide()

	# Check block collisions (via move_and_slide)
	for i: int in get_slide_collision_count():
		var collision: KinematicCollision2D = get_slide_collision(i)
		var collider: Object = collision.get_collider()
		if collider is Block:
			(collider as Block).take_damage(hp)
			die(true)
			return

func _find_target() -> Vector2:
	var nearest_dist: float = config.aggro_range
	var nearest_pos: Vector2 = Constants.TARGET_POS

	for runner: CharacterBody2D in runners_in_range:
		var dist: float = global_position.distance_to(runner.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest_pos = runner.global_position

	return nearest_pos

func _draw() -> void:
	draw_circle(Vector2.ZERO, config.radius, Color(1.0, 0.27, 0.13))
	# HP bar
	if hp < config.hp:
		var bar_w: float = config.radius * 2.0
		var ratio: float = float(hp) / float(config.hp)
		DrawUtils.draw_bar(self, 0.0, -config.radius - 6.0, bar_w, 3.0, ratio, Color(1.0, 0.0, 0.0))
