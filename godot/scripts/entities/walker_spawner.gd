extends SpawnerBase
class_name WalkerSpawner

signal walker_requested(pos: Vector2)

@export var config: WalkerRegionConfig = preload("res://resources/defaults/walker_region_default.tres")

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

func _emit_spawn(spawn_pos: Vector2) -> void:
	walker_requested.emit(spawn_pos)

func _draw() -> void:
	var hp_ratio: float = float(hp) / float(max_hp) if max_hp > 0 else 1.0
	var pulse: float = sin(age * 4.0) * 0.15 + 0.85
	var alpha: float = (0.3 + 0.3 * hp_ratio) * pulse

	draw_circle(Vector2.ZERO, region_radius, Color(0.6, 0.2, 0.8, alpha))
	draw_arc(Vector2.ZERO, region_radius, 0, TAU, 32, Color(0.8, 0.3, 1.0, alpha * 1.5), 2.0)
	DrawUtils.draw_bar(self, 0.0, -region_radius - 10.0, region_radius * 1.5, 4.0, hp_ratio, Color(0.8, 0.3, 1.0))
