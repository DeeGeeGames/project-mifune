extends Area2D
class_name ResourcePickup

var value: int = Constants.RESOURCE_DROP_VALUE
var claimed_by_runner: Node2D = null

func _ready() -> void:
	add_to_group("resources")
	JobBoard.register_resource(self)
	tree_exiting.connect(_on_tree_exiting)

func _on_tree_exiting() -> void:
	JobBoard.unregister_resource(self)

func claim(runner: Node2D) -> void:
	claimed_by_runner = runner

func unclaim() -> void:
	claimed_by_runner = null

func is_claimed() -> bool:
	return claimed_by_runner != null

func collect() -> int:
	var v: int = value
	queue_free()
	return v

func _draw() -> void:
	draw_circle(Vector2.ZERO, 6.0, Color(0.2, 0.9, 0.2))
	draw_arc(Vector2.ZERO, 6.0, 0, TAU, 16, Color.WHITE, 1.5)
