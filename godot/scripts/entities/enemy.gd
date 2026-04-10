extends EnemyBase
class_name Enemy

@export var config: EnemyConfig = preload("res://resources/defaults/enemy_default.tres")

var speed: float = 0.0
var spawn_momentum: Vector2 = Vector2.ZERO
var momentum_factor: float = 1.0
var base_velocity: Vector2 = Vector2.ZERO

func _ready() -> void:
	super._ready()
	health.initialize(config.hp)
	speed = config.speed
	($CollisionShape2D.shape as CircleShape2D).radius = config.radius
	aggro_area.tracking_range = config.aggro_range

func initialize(pos: Vector2, momentum: Vector2) -> void:
	position = pos
	spawn_momentum = momentum
	momentum_factor = 1.0

func get_velocity_for_targeting() -> Vector2:
	return base_velocity

func _physics_process(delta: float) -> void:
	momentum_factor = maxf(0.0, momentum_factor - config.momentum_decay * delta)

	var target_pos: Vector2 = find_nearest_runner_or_base()
	base_velocity = Targeting.velocity_toward(global_position, target_pos, speed)

	velocity = base_velocity * (1.0 - momentum_factor) + spawn_momentum * momentum_factor
	move_and_slide()

	for i: int in get_slide_collision_count():
		var collider: Object = get_slide_collision(i).get_collider()
		if collider is Block:
			(collider as Block).take_damage(health.hp)
			die(true)
			return

func _draw() -> void:
	draw_circle(Vector2.ZERO, config.radius, Color(1.0, 0.27, 0.13))
	if health.hp < health.hp_max:
		DrawUtils.draw_bar(self, 0.0, -config.radius - 6.0, config.radius * 2.0, 3.0, health.get_ratio(), Color(1.0, 0.0, 0.0))
