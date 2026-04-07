extends StaticBody2D
class_name Block

signal destroyed(block_id: int)

@export var config: BlockConfig = preload("res://resources/defaults/block_default.tres")

var hp: int = 0
var max_hp: int = 0
var block_id: int = 0

func _ready() -> void:
	hp = config.hp
	max_hp = config.hp
	add_to_group("blocks")
	block_id = get_instance_id()

func initialize(pos: Vector2) -> void:
	position = pos

func take_damage(amount: int) -> void:
	hp -= amount
	queue_redraw()
	if hp <= 0:
		destroyed.emit(block_id)
		queue_free()

func _draw() -> void:
	var half: float = config.size / 2.0
	var rect: Rect2 = Rect2(-half, -half, config.size, config.size)
	var hp_ratio: float = float(hp) / float(max_hp)
	var color: Color = Color(0.55, 0.35, 0.15).lerp(Color(0.3, 0.15, 0.05), 1.0 - hp_ratio)
	draw_rect(rect, color)
	draw_rect(rect, Color(0.7, 0.5, 0.25), false, 2.0)

	if hp < max_hp:
		DrawUtils.draw_bar(self, 0.0, -half - 6.0, config.size, 3.0, hp_ratio, Color(0.0, 0.8, 0.0))
