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
	tree_exiting.connect(GameManager.runner_count_changed.emit)
	GameManager.runner_count_changed.emit()

func die() -> void:
	_release_claims()
	queue_free()

func _release_claims() -> void:
	if target_node == null or not is_instance_valid(target_node):
		return
	if current_state == State.RESUPPLYING and target_node is Defender:
		(target_node as Defender).unclaim()
	elif current_state == State.COLLECTING and target_node is ResourcePickup:
		(target_node as ResourcePickup).unclaim()

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
		if not _try_take_ammo_job():
			_try_take_resource_job()
	else:
		if not _try_take_resource_job():
			_try_take_ammo_job()

func _try_take_resource_job() -> bool:
	var picked: Node2D = JobBoard.take_nearest_resource(global_position, self)
	if picked == null:
		return false
	target_node = picked
	current_state = State.COLLECTING
	return true

func _try_take_ammo_job() -> bool:
	# Runners only resupply while at the base — preserves the original
	# "drop loot, then ferry ammo" loop instead of letting them roam.
	if global_position.distance_to(Constants.TARGET_POS) > config.base_arrive_distance:
		return false
	var picked: Node2D = JobBoard.take_nearest_ammo_job(global_position, self)
	if picked == null:
		return false
	target_node = picked
	current_state = State.RESUPPLYING
	return true

func _tick_collecting(_delta: float) -> void:
	if not is_instance_valid(target_node):
		current_state = State.IDLE
		target_node = null
		return

	if global_position.distance_to(target_node.global_position) < config.pickup_distance:
		carrying = (target_node as ResourcePickup).collect()
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
		var defender: Defender = target_node as Defender
		defender.reload(config.reload_amount)
		defender.unclaim()
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

	DrawUtils.draw_unit_body(self, Vector2.ZERO, config.size, color)
