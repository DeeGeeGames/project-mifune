class_name DrawUtils

static func draw_bar(canvas: CanvasItem, center_x: float, y: float, width: float, height: float, ratio: float, fg_color: Color, bg_color: Color = Color(0.2, 0.2, 0.2)) -> void:
	canvas.draw_rect(Rect2(center_x - width / 2.0, y, width, height), bg_color)
	canvas.draw_rect(Rect2(center_x - width / 2.0, y, width * ratio, height), fg_color)

static func draw_unit_body(canvas: CanvasItem, center: Vector2, size: float, color: Color) -> void:
	canvas.draw_rect(Rect2(center.x - size / 2.0, center.y - size, size, size * 2.0), color)

static func draw_arc_wedge(canvas: CanvasItem, center: Vector2, radius: float, arc_center: float, arc_width: float, color: Color, steps: int = 20) -> void:
	var start_angle: float = arc_center - arc_width / 2.0
	var end_angle: float = arc_center + arc_width / 2.0
	var points: PackedVector2Array = PackedVector2Array()
	points.append(center)
	for i: int in steps + 1:
		var a: float = start_angle + (end_angle - start_angle) * float(i) / float(steps)
		points.append(center + Vector2(cos(a), sin(a)) * radius)
	points.append(center)
	canvas.draw_colored_polygon(points, color)
