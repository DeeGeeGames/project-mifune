extends CharacterBody2D
# Shared base for hostile entities (Enemy, Walker). Owns hp, damage/death API,
# and the find-nearest-runner targeting helper. Runner proximity tracking is
# delegated to a TrackingArea child node ("AggroArea").
# Subclasses set hp_max from their own config before calling super._ready(),
# and override get_velocity_for_targeting() to report the velocity turrets
# should lead against.
class_name EnemyBase

var hp: int = 0
var hp_max: int = 0

@onready var aggro_area: TrackingArea = $AggroArea

# --- Subclass overrides ---
func get_velocity_for_targeting() -> Vector2:
	return Vector2.ZERO

# --- Lifecycle ---
func _ready() -> void:
	hp = hp_max
	add_to_group("enemies")

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

func find_nearest_runner_or_base() -> Vector2:
	var nearest: Node2D = aggro_area.get_nearest(global_position)
	if nearest != null:
		return nearest.global_position
	return Constants.TARGET_POS
