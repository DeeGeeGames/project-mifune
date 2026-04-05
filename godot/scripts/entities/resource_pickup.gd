extends Area2D
class_name ResourcePickup

var value: int = Constants.RESOURCE_DROP_VALUE
var claimed_by: Node = null

func _ready() -> void:
	add_to_group("resources")

func collect() -> int:
	var v: int = value
	queue_free()
	return v

func _draw() -> void:
	draw_circle(Vector2.ZERO, 6.0, Color(0.2, 0.9, 0.2))
	draw_arc(Vector2.ZERO, 6.0, 0, TAU, 16, Color.WHITE, 1.5)
