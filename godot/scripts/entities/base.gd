extends Area2D
class_name Base

func _ready() -> void:
	position = Constants.TARGET_POS
	body_entered.connect(_on_body_entered)
	GameManager.defense_damaged.connect(_on_defense_damaged)

func _on_body_entered(body: Node2D) -> void:
	if body is EnemyBase:
		var enemy: EnemyBase = body as EnemyBase
		GameManager.damage_defense(enemy.get_hp())
		enemy.die(false)

func _on_defense_damaged(_new_hp: int) -> void:
	queue_redraw()

func _draw() -> void:
	draw_circle(Vector2.ZERO, Constants.TARGET_RADIUS, Color(1.0, 0.67, 0.0, 0.6))
	draw_arc(Vector2.ZERO, Constants.TARGET_RADIUS, 0, TAU, 32, Color.WHITE, 2.0)

	var hp_ratio: float = float(GameManager.defense_hp) / float(Constants.DEFENSE_HP)
	var fg_color: Color = Color(0.0, 1.0, 0.0) if hp_ratio > 0.5 else Color(1.0, 0.0, 0.0)
	DrawUtils.draw_bar(self, 0.0, -Constants.TARGET_RADIUS - 10.0, Constants.TARGET_RADIUS * 2.0, 4.0, hp_ratio, fg_color)
