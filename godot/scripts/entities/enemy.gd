extends CharacterBody2D
class_name Enemy

var hp: int = Constants.ENEMY_HP
var speed: float = Constants.ENEMY_SPEED
var spawn_momentum: Vector2 = Vector2.ZERO
var momentum_factor: float = 1.0
var base_velocity: Vector2 = Vector2.ZERO

func _ready() -> void:
	add_to_group("enemies")

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

func die(drop_resource: bool) -> void:
	if drop_resource:
		GameManager.enemy_died.emit(global_position)
	queue_free()

func _physics_process(delta: float) -> void:
	# Decay momentum
	momentum_factor = maxf(0.0, momentum_factor - Constants.ENEMY_MOMENTUM_DECAY * delta)

	# Find target (runner aggro or base)
	var target_pos: Vector2 = _find_target()
	base_velocity = Targeting.velocity_toward(global_position, target_pos, speed)

	# Blend homing with spawn momentum
	var move_vel: Vector2 = base_velocity * (1.0 - momentum_factor) + spawn_momentum * momentum_factor
	velocity = move_vel
	move_and_slide()

	# Check runner kills
	_check_runner_contact()

	# Check block collisions (via move_and_slide)
	for i: int in get_slide_collision_count():
		var collision: KinematicCollision2D = get_slide_collision(i)
		var collider: Object = collision.get_collider()
		if collider is Block:
			(collider as Block).take_damage(hp)
			die(true)
			return

func _find_target() -> Vector2:
	var nearest_dist: float = Constants.ENEMY_RUNNER_AGGRO_RANGE
	var nearest_pos: Vector2 = Constants.TARGET_POS

	for runner: Node in get_tree().get_nodes_in_group("runners"):
		var dist: float = global_position.distance_to(runner.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest_pos = runner.global_position

	return nearest_pos

func _check_runner_contact() -> void:
	var contact_dist: float = Constants.RUNNER_SIZE + Constants.ENEMY_RADIUS
	for runner: Node in get_tree().get_nodes_in_group("runners"):
		if global_position.distance_to(runner.global_position) < contact_dist:
			if runner is Runner:
				(runner as Runner).die()

func _draw() -> void:
	draw_circle(Vector2.ZERO, Constants.ENEMY_RADIUS, Color(1.0, 0.27, 0.13))
	# HP bar
	if hp < Constants.ENEMY_HP:
		var bar_w: float = Constants.ENEMY_RADIUS * 2.0
		var ratio: float = float(hp) / float(Constants.ENEMY_HP)
		DrawUtils.draw_bar(self, 0.0, -Constants.ENEMY_RADIUS - 6.0, bar_w, 3.0, ratio, Color(1.0, 0.0, 0.0))
