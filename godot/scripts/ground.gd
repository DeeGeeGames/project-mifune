extends Node2D

func _draw() -> void:
	# Ground line
	draw_line(
		Vector2(0, Constants.GROUND_Y),
		Vector2(Constants.WORLD_WIDTH, Constants.GROUND_Y),
		Color(0.45, 0.32, 0.15),
		4.0,
	)
	# Ground fill below
	draw_rect(
		Rect2(0, Constants.GROUND_Y, Constants.WORLD_WIDTH, Constants.WORLD_HEIGHT - Constants.GROUND_Y),
		Color(0.3, 0.22, 0.1),
	)
