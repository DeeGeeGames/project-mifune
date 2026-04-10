extends StaticBody2D
class_name Block

signal destroyed(block_id: int)

@export var config: BlockConfig = preload("res://resources/defaults/block_default.tres")

var block_id: int = 0

@onready var health: HealthComponent = $HealthComponent

func _ready() -> void:
	health.initialize(config.hp)
	add_to_group("blocks")
	block_id = get_instance_id()
	($CollisionShape2D.shape as RectangleShape2D).size = Vector2(config.size, config.size)
	health.died.connect(_on_died)
	health.damaged.connect(_on_damaged)

func initialize(pos: Vector2) -> void:
	position = pos

func take_damage(amount: int) -> void:
	health.take_damage(amount)

func _on_damaged(_new_hp: int) -> void:
	queue_redraw()

func _on_died() -> void:
	destroyed.emit(block_id)
	queue_free()

func _draw() -> void:
	var half: float = config.size / 2.0
	var rect: Rect2 = Rect2(-half, -half, config.size, config.size)
	var hp_ratio: float = health.get_ratio()
	var color: Color = Color(0.55, 0.35, 0.15).lerp(Color(0.3, 0.15, 0.05), 1.0 - hp_ratio)
	draw_rect(rect, color)
	draw_rect(rect, Color(0.7, 0.5, 0.25), false, 2.0)

	if health.hp < health.hp_max:
		DrawUtils.draw_bar(self, 0.0, -half - 6.0, config.size, 3.0, hp_ratio, Color(0.0, 0.8, 0.0))
