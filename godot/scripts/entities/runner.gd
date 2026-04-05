extends CharacterBody2D
class_name Runner

enum State { IDLE, COLLECTING, RETURNING, RESUPPLYING }

var current_state: State = State.IDLE
var target_node: Node2D = null
var carrying: int = 0
var speed: float = Constants.RUNNER_SPEED

func die() -> void:
	queue_free()

func _physics_process(delta: float) -> void:
	match current_state:
		State.IDLE:
			_tick_idle()
		State.COLLECTING:
			_tick_collecting(delta)
		State.RETURNING:
			_tick_returning(delta)
		State.RESUPPLYING:
			_tick_resupplying(delta)

	queue_redraw()

func _tick_idle() -> void:
	var primary_found: bool = false
	var secondary_found: bool = false

	if GameManager.runner_priority == "ammo":
		primary_found = _try_find_ammo_task()
		if not primary_found:
			secondary_found = _try_find_resource_task()
	else:
		primary_found = _try_find_resource_task()
		if not primary_found:
			secondary_found = _try_find_ammo_task()

func _try_find_resource_task() -> bool:
	if not is_instance_valid(GameManager.resources_container):
		return false

	var nearest: Area2D = null
	var nearest_dist: float = INF

	for resource: Node in GameManager.resources_container.get_children():
		if not is_instance_valid(resource):
			continue
		if resource.claimed_by != null and resource.claimed_by != self:
			continue
		var dist: float = global_position.distance_to(resource.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = resource

	if nearest == null:
		return false

	nearest.claimed_by = self
	target_node = nearest
	current_state = State.COLLECTING
	return true

func _try_find_ammo_task() -> bool:
	# Can only resupply if near base
	if global_position.distance_to(Constants.TARGET_POS) > Constants.RUNNER_BASE_ARRIVE_DISTANCE:
		return false

	if not is_instance_valid(GameManager.turrets_container):
		return false

	var nearest: Node2D = null
	var nearest_dist: float = INF

	for turret: Node in GameManager.turrets_container.get_children():
		if not is_instance_valid(turret):
			continue
		if not turret is Turret or not (turret as Turret).needs_ammo():
			continue
		# Check if already claimed by another runner
		if _is_turret_claimed(turret):
			continue
		var dist: float = global_position.distance_to(turret.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = turret

	if nearest == null:
		return false

	target_node = nearest
	current_state = State.RESUPPLYING
	return true

func _is_turret_claimed(turret: Node2D) -> bool:
	if not is_instance_valid(GameManager.runners_container):
		return false
	for runner: Node in GameManager.runners_container.get_children():
		if runner == self:
			continue
		if runner.current_state == State.RESUPPLYING and runner.target_node == turret:
			return true
	return false

func _tick_collecting(_delta: float) -> void:
	if not is_instance_valid(target_node):
		current_state = State.IDLE
		target_node = null
		return

	var dir: Vector2 = (target_node.global_position - global_position)
	if dir.length() < Constants.RUNNER_PICKUP_DISTANCE:
		carrying = target_node.collect()
		target_node = null
		current_state = State.RETURNING
		return

	velocity = dir.normalized() * speed
	move_and_slide()

func _tick_returning(_delta: float) -> void:
	var to_base: Vector2 = Constants.TARGET_POS - global_position
	if to_base.length() < Constants.RUNNER_BASE_ARRIVE_DISTANCE:
		GameManager.add_currency(carrying)
		carrying = 0
		position = Constants.TARGET_POS
		current_state = State.IDLE
		return

	velocity = to_base.normalized() * speed
	move_and_slide()

func _tick_resupplying(_delta: float) -> void:
	if not is_instance_valid(target_node):
		current_state = State.IDLE
		target_node = null
		return

	var dir: Vector2 = (target_node.global_position - global_position)
	if dir.length() < Constants.RUNNER_BASE_ARRIVE_DISTANCE:
		if target_node is Turret:
			(target_node as Turret).reload(Constants.RUNNER_RELOAD_AMOUNT)
		target_node = null
		current_state = State.IDLE
		return

	velocity = dir.normalized() * speed
	move_and_slide()

func _draw() -> void:
	var color: Color
	match current_state:
		State.IDLE:
			color = Color(0.3, 0.3, 1.0)
		State.COLLECTING:
			color = Color(0.0, 1.0, 1.0)
		State.RETURNING:
			color = Color(0.0, 1.0, 0.0)
		State.RESUPPLYING:
			color = Color(1.0, 0.6, 0.0)

	var rect: Rect2 = Rect2(-Constants.RUNNER_SIZE / 2.0, -Constants.RUNNER_SIZE, Constants.RUNNER_SIZE, Constants.RUNNER_SIZE * 2.0)
	draw_rect(rect, color)
