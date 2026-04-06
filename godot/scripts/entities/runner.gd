extends CharacterBody2D
class_name Runner

enum State { IDLE, COLLECTING, RETURNING, RESUPPLYING }

@export var config: RunnerConfig = preload("res://resources/defaults/runner_default.tres")

var current_state: State = State.IDLE
var target_node: Node2D = null
var carrying: int = 0
var speed: float = 0.0
var _prev_state: State = State.IDLE

@onready var hurt_area: Area2D = $HurtArea

func _ready() -> void:
	speed = config.speed
	add_to_group("runners")
	hurt_area.body_entered.connect(_on_hurt_area_body_entered)

func die() -> void:
	_release_claims()
	queue_free()

func _release_claims() -> void:
	if target_node == null or not is_instance_valid(target_node):
		return
	if current_state == State.RESUPPLYING and target_node.has_method("unclaim"):
		target_node.unclaim()
	elif current_state == State.COLLECTING and target_node is ResourcePickup:
		(target_node as ResourcePickup).claimed_by = null

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

	if current_state != _prev_state:
		_prev_state = current_state
		queue_redraw()

func _tick_idle() -> void:
	if GameManager.runner_priority == GameManagerClass.RunnerPriority.AMMO:
		if not _try_find_ammo_task():
			_try_find_resource_task()
	else:
		if not _try_find_resource_task():
			_try_find_ammo_task()

func _try_find_resource_task() -> bool:
	var nearest: Area2D = null
	var nearest_dist: float = INF

	for resource: Node in get_tree().get_nodes_in_group("resources"):
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
	if global_position.distance_to(Constants.TARGET_POS) > config.base_arrive_distance:
		return false

	var candidates: Array[Node] = []
	candidates.append_array(get_tree().get_nodes_in_group("turrets"))
	candidates.append_array(get_tree().get_nodes_in_group("soldiers"))

	var nearest: Node2D = null
	var nearest_dist: float = INF

	for unit: Node in candidates:
		if not is_instance_valid(unit) or not unit.has_method("needs_ammo"):
			continue
		if not unit.needs_ammo() or unit.is_claimed():
			continue
		var dist: float = global_position.distance_to(unit.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = unit as Node2D

	if nearest == null:
		return false

	nearest.claim(self)
	target_node = nearest
	current_state = State.RESUPPLYING
	return true

func _tick_collecting(_delta: float) -> void:
	if not is_instance_valid(target_node):
		current_state = State.IDLE
		target_node = null
		return

	if global_position.distance_to(target_node.global_position) < config.pickup_distance:
		carrying = target_node.collect()
		target_node = null
		current_state = State.RETURNING
		return

	velocity = Targeting.velocity_toward(global_position, target_node.global_position, speed)
	move_and_slide()

func _tick_returning(_delta: float) -> void:
	if global_position.distance_to(Constants.TARGET_POS) < config.base_arrive_distance:
		GameManager.add_currency(carrying)
		carrying = 0
		position = Constants.TARGET_POS
		current_state = State.IDLE
		return

	velocity = Targeting.velocity_toward(global_position, Constants.TARGET_POS, speed)
	move_and_slide()

func _tick_resupplying(_delta: float) -> void:
	if not is_instance_valid(target_node):
		current_state = State.IDLE
		target_node = null
		return

	if global_position.distance_to(target_node.global_position) < config.base_arrive_distance:
		if target_node.has_method("reload"):
			target_node.reload(config.reload_amount)
			target_node.unclaim()
		target_node = null
		current_state = State.IDLE
		return

	velocity = Targeting.velocity_toward(global_position, target_node.global_position, speed)
	move_and_slide()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body is Enemy:
		die()

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

	var rect: Rect2 = Rect2(-config.size / 2.0, -config.size, config.size, config.size * 2.0)
	draw_rect(rect, color)
