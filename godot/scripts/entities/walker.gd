extends CharacterBody2D
class_name Walker

signal died(pos: Vector2)

@export var config: WalkerConfig = preload("res://resources/defaults/walker_default.tres")

var hp: int = 0
var speed: float = 0.0
var _on_ground: bool = false
var runners_in_range: Array[CharacterBody2D] = []

@onready var aggro_area: Area2D = $AggroArea

func _ready() -> void:
	hp = config.hp
	speed = config.speed
	add_to_group("enemies")
	aggro_area.body_entered.connect(_on_aggro_body_entered)
	aggro_area.body_exited.connect(_on_aggro_body_exited)

func initialize(pos: Vector2) -> void:
	position = pos
	_on_ground = false

func get_hp() -> int:
	return hp

func get_velocity_for_targeting() -> Vector2:
	return velocity

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

	if not _on_ground:
		_tick_falling(delta)
	else:
		_tick_walking(delta)

func _tick_falling(_delta: float) -> void:
	velocity = Vector2(0.0, config.fall_speed)
	move_and_slide()

	if global_position.y >= Constants.GROUND_Y - config.radius:
		global_position.y = Constants.GROUND_Y - config.radius
		_on_ground = true

func _tick_walking(_delta: float) -> void:
	var target_pos: Vector2 = _find_target()
	var dir: float = signf(target_pos.x - global_position.x)
	velocity = Vector2(dir * speed, 0.0)
	move_and_slide()

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
	var half: float = config.radius
	draw_rect(Rect2(-half, -half, half * 2.0, half * 2.0), Color(0.6, 0.2, 0.8))
	# HP bar
	if hp < config.hp:
		var bar_w: float = config.radius * 2.0
		var ratio: float = float(hp) / float(config.hp)
		DrawUtils.draw_bar(self, 0.0, -config.radius - 6.0, bar_w, 3.0, ratio, Color(1.0, 0.0, 0.0))
