extends CharacterBody2D
# Shared base for hostile entities (Enemy, Walker). Owns hp, runner aggro
# tracking, damage/death API, and the find-nearest-runner targeting helper.
# Subclasses set hp_max / aggro_range from their own config before calling
# super._ready(), and override get_velocity_for_targeting() to report the
# velocity turrets should lead against.
class_name EnemyBase

var hp: int = 0
var hp_max: int = 0
var aggro_range: float = 0.0
var runners_in_range: Array[Runner] = []

@onready var aggro_area: Area2D = $AggroArea

# --- Subclass overrides ---
func get_velocity_for_targeting() -> Vector2:
	return Vector2.ZERO

# --- Lifecycle ---
func _ready() -> void:
	hp = hp_max
	add_to_group("enemies")
	aggro_area.body_entered.connect(_on_aggro_body_entered)
	aggro_area.body_exited.connect(_on_aggro_body_exited)

func get_hp() -> int:
	return hp

func take_damage(amount: int) -> void:
	hp -= amount
	if hp <= 0:
		die(true)
		return
	queue_redraw()

func die(drop_resource: bool) -> void:
	if drop_resource:
		GameManager.request_resource_drop(global_position)
	queue_free()

# --- Runner aggro tracking ---
func _on_aggro_body_entered(body: Node2D) -> void:
	if body is Runner:
		runners_in_range.append(body)
		# body_exited may not fire on queue_free, so listen for tree_exiting too.
		body.tree_exiting.connect(_on_tracked_runner_exiting.bind(body), CONNECT_ONE_SHOT)

func _on_aggro_body_exited(body: Node2D) -> void:
	if body is Runner:
		runners_in_range.erase(body)

func _on_tracked_runner_exiting(body: Runner) -> void:
	runners_in_range.erase(body)

func find_nearest_runner_or_base() -> Vector2:
	var nearest_dist: float = aggro_range
	var nearest_pos: Vector2 = Constants.TARGET_POS

	for runner: Runner in runners_in_range:
		var dist: float = global_position.distance_to(runner.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest_pos = runner.global_position

	return nearest_pos
