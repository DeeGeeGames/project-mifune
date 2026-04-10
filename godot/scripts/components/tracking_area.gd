extends Area2D
# Reusable component that safely tracks bodies entering/exiting its collision
# shape. Handles the queue_free edge case where body_exited may not fire by
# also listening to tree_exiting on each tracked body.
# Parent sets collision layers/mask and shape in the scene. Optionally export
# tracking_range to sync the shape radius from script.
class_name TrackingArea

@export var tracking_range: float = 0.0:
	set(value):
		tracking_range = value
		if tracking_range > 0.0 and is_inside_tree():
			($CollisionShape2D.shape as CircleShape2D).radius = tracking_range

var bodies_in_range: Array[Node2D] = []

func _ready() -> void:
	if tracking_range > 0.0:
		($CollisionShape2D.shape as CircleShape2D).radius = tracking_range
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

func get_nearest(origin: Vector2) -> Node2D:
	var nearest: Node2D = null
	var nearest_dist: float = INF

	for body: Node2D in bodies_in_range:
		var dist: float = origin.distance_to(body.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = body

	return nearest

func _on_body_entered(body: Node2D) -> void:
	bodies_in_range.append(body)
	body.tree_exiting.connect(_on_tracked_body_exiting.bind(body), CONNECT_ONE_SHOT)

func _on_body_exited(body: Node2D) -> void:
	bodies_in_range.erase(body)

func _on_tracked_body_exiting(body: Node2D) -> void:
	bodies_in_range.erase(body)
