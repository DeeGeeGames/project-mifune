extends SpawnerBase
class_name SpawnRegion

signal enemy_requested(pos: Vector2, momentum: Vector2)

@export var config: RegionConfig = preload("res://resources/defaults/region_default.tres")

var burst_arc_center: float = 0.0
var burst_arc_width: float = 0.0

func _base_lifetime() -> float: return config.base_lifetime
func _lifetime_scaling() -> float: return config.lifetime_scaling
func _max_lifetime() -> float: return config.max_lifetime
func _base_hp() -> int: return config.base_hp
func _hp_scaling() -> int: return config.hp_scaling
func _base_radius() -> float: return config.base_radius
func _radius_scaling() -> float: return config.radius_scaling
func _max_radius() -> float: return config.max_radius
func _base_spawn_interval() -> float: return config.base_spawn_interval
func _spawn_interval_scaling() -> float: return config.spawn_interval_scaling
func _min_spawn_interval() -> float: return config.min_spawn_interval

func _ready() -> void:
	super._ready()
	burst_arc_width = config.burst_arc_width
	burst_arc_center = _random_arc_center(burst_arc_width, config.burst_valid_range_center, config.burst_valid_range_width)

func _random_arc_center(arc_w: float, valid_center: float, valid_width: float) -> float:
	var slack: float = valid_width / 2.0 - arc_w / 2.0
	if slack <= 0.0:
		return valid_center
	return valid_center + (randf() * 2.0 - 1.0) * slack

func _emit_spawn(spawn_pos: Vector2) -> void:
	var burst_angle: float = burst_arc_center + (randf() * 2.0 - 1.0) * (burst_arc_width / 2.0)
	var burst_speed: float = Constants.ENEMY_SPAWN_BURST_SPEED * (0.5 + randf() * 0.5)
	var momentum: Vector2 = Vector2.from_angle(burst_angle) * burst_speed
	enemy_requested.emit(spawn_pos, momentum)

func _draw() -> void:
	var hp_ratio: float = float(hp) / float(max_hp) if max_hp > 0 else 1.0
	var pulse: float = sin(age * 4.0) * 0.15 + 0.85
	var alpha: float = (0.3 + 0.3 * hp_ratio) * pulse

	draw_circle(Vector2.ZERO, region_radius, Color(0.8, 0.2, 0.8, alpha))
	draw_arc(Vector2.ZERO, region_radius, 0, TAU, 32, Color(1.0, 0.3, 1.0, alpha * 1.5), 2.0)
	DrawUtils.draw_bar(self, 0.0, -region_radius - 10.0, region_radius * 1.5, 4.0, hp_ratio, Color(1.0, 0.3, 1.0))
