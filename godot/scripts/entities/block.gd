extends StaticBody2D
class_name Block

var hp: int = Constants.BLOCK_HP
var max_hp: int = Constants.BLOCK_HP
var block_id: int = 0

func _ready() -> void:
	add_to_group("blocks")
	block_id = get_instance_id()

func initialize(pos: Vector2) -> void:
	position = pos

func take_damage(amount: int) -> void:
	hp -= amount
	queue_redraw()
	if hp <= 0:
		GameManager.block_destroyed.emit(block_id)
		queue_free()

func _draw() -> void:
	var half: float = Constants.BLOCK_HALF
	var rect: Rect2 = Rect2(-half, -half, Constants.BLOCK_SIZE, Constants.BLOCK_SIZE)
	var hp_ratio: float = float(hp) / float(max_hp)
	var color: Color = Color(0.55, 0.35, 0.15).lerp(Color(0.3, 0.15, 0.05), 1.0 - hp_ratio)
	draw_rect(rect, color)
	draw_rect(rect, Color(0.7, 0.5, 0.25), false, 2.0)

	# HP bar
	if hp < max_hp:
		DrawUtils.draw_bar(self, 0.0, -half - 6.0, Constants.BLOCK_SIZE, 3.0, hp_ratio, Color(0.0, 0.8, 0.0))
