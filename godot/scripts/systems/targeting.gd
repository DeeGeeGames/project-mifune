class_name Targeting

static func normalize_angle_diff(target_angle: float, current: float) -> float:
	return fmod(target_angle - current + 3.0 * PI, 2.0 * PI) - PI

static func is_angle_in_arc(angle: float, arc_center: float, arc_width: float) -> bool:
	return absf(normalize_angle_diff(angle, arc_center)) <= arc_width / 2.0

static func clamp_arc_center_to_range(
	desired_center: float,
	arc_width: float,
	range_center: float,
	range_width: float,
) -> float:
	var clamped_width: float = minf(arc_width, range_width)
	var half_range: float = range_width / 2.0
	var half_arc: float = clamped_width / 2.0
	var diff: float = normalize_angle_diff(desired_center, range_center)
	var clamped_diff: float = clampf(diff, -half_range + half_arc, half_range - half_arc)
	return range_center + clamped_diff

static func clamp_angle_to_arc(angle: float, arc_center: float, arc_width: float) -> float:
	var diff: float = normalize_angle_diff(angle, arc_center)
	var half_arc: float = arc_width / 2.0
	if absf(diff) <= half_arc:
		return angle
	return arc_center + (half_arc if diff > 0 else -half_arc)

static func rotate_toward(current: float, target_angle: float, max_delta: float) -> float:
	var diff: float = normalize_angle_diff(target_angle, current)
	return current + clampf(diff, -max_delta, max_delta)

static func lead_target(from: Vector2, target_pos: Vector2, target_vel: Vector2, bullet_speed: float) -> Vector2:
	var dx: float = target_pos.x - from.x
	var dy: float = target_pos.y - from.y
	var ex: float = target_vel.x
	var ey: float = target_vel.y

	var a: float = ex * ex + ey * ey - bullet_speed * bullet_speed
	var b: float = 2.0 * (dx * ex + dy * ey)
	var c: float = dx * dx + dy * dy
	var discriminant: float = b * b - 4.0 * a * c

	if discriminant < 0.0:
		return target_pos

	var sqrt_d: float = sqrt(discriminant)
	var t1: float = (-b - sqrt_d) / (2.0 * a)
	var t2: float = (-b + sqrt_d) / (2.0 * a)
	var t: float = t1 if t1 > 0.0 else (t2 if t2 > 0.0 else 0.0)

	return Vector2(target_pos.x + ex * t, target_pos.y + ey * t)

static func aim_angle(from: Vector2, to: Vector2) -> float:
	return (to - from).angle()

static func velocity_toward(from: Vector2, to: Vector2, speed: float) -> Vector2:
	var dir: Vector2 = to - from
	if dir.length_squared() < 1.0:
		return Vector2.ZERO
	return dir.normalized() * speed
