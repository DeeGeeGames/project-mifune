extends CharacterBody2D
# Shared base for hostile entities (Enemy, Walker). Owns the find-nearest-runner
# targeting helper. HP is delegated to a HealthComponent child node. Runner
# proximity tracking is delegated to a TrackingArea child node ("AggroArea").
# Subclasses initialize health via health.initialize() in their own _ready(),
# and override get_velocity_for_targeting() to report the velocity turrets
# should lead against.
class_name EnemyBase

@onready var health: HealthComponent = $HealthComponent
@onready var aggro_area: TrackingArea = $AggroArea

# --- Subclass overrides ---
func get_velocity_for_targeting() -> Vector2:
	return Vector2.ZERO

# --- Lifecycle ---
func _ready() -> void:
	add_to_group("enemies")
	health.died.connect(_on_died)
	health.damaged.connect(_on_damaged)

func get_hp() -> int:
	return health.hp

func take_damage(amount: int) -> void:
	health.take_damage(amount)

func _on_damaged(_new_hp: int) -> void:
	queue_redraw()

func _on_died() -> void:
	die(true)

func die(drop_resource: bool) -> void:
	if drop_resource:
		GameManager.request_resource_drop(global_position)
	queue_free()

func find_nearest_runner_or_base() -> Vector2:
	var nearest: Node2D = aggro_area.get_nearest(global_position)
	if nearest != null:
		return nearest.global_position
	return Constants.TARGET_POS
