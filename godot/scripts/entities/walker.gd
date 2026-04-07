extends EnemyBase
class_name Walker

@export var config: WalkerConfig = preload("res://resources/defaults/walker_default.tres")

var speed: float = 0.0
var _on_ground: bool = false

func _max_hp() -> int:
	return config.hp

func _aggro_range() -> float:
	return config.aggro_range

func _ready() -> void:
	super._ready()
	speed = config.speed

func initialize(pos: Vector2) -> void:
	position = pos
	_on_ground = false

func get_velocity_for_targeting() -> Vector2:
	return velocity

func _physics_process(delta: float) -> void:
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
	var target_pos: Vector2 = find_nearest_runner_or_base()
	var dir: float = signf(target_pos.x - global_position.x)
	velocity = Vector2(dir * speed, 0.0)
	move_and_slide()

	for i: int in get_slide_collision_count():
		var collider: Object = get_slide_collision(i).get_collider()
		if collider is Block:
			(collider as Block).take_damage(hp)
			die(true)
			return

func _draw() -> void:
	var half: float = config.radius
	draw_rect(Rect2(-half, -half, half * 2.0, half * 2.0), Color(0.6, 0.2, 0.8))
	if hp < config.hp:
		var ratio: float = float(hp) / float(config.hp)
		DrawUtils.draw_bar(self, 0.0, -config.radius - 6.0, config.radius * 2.0, 3.0, ratio, Color(1.0, 0.0, 0.0))
