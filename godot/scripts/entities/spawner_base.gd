extends Area2D
class_name Spawner
# Enemy-producing region. Owns wave-scaled params, HP / lifetime, the
# collision shape sizing, and the spawn cadence timer. Per-type behavior
# (burst momentum, visual color) lives on the SpawnerConfig resource.

signal spawn_requested(pos: Vector2, momentum: Vector2)

@export var config: SpawnerConfig

var hp: int = 0
var max_hp: int = 0
var lifetime: float = 0.0
var age: float = 0.0
var region_radius: float = 0.0
var spawn_interval: float = 0.0
var burst_arc_center: float = 0.0
var _wave_number: int = 1

@onready var spawn_timer: Timer = $SpawnTimer
@onready var collision_shape: CollisionShape2D = $CollisionShape2D

# --- API ---
func initialize(wave_number: int) -> void:
	_wave_number = wave_number

func take_damage(amount: int) -> void:
	hp -= amount
	if hp <= 0:
		queue_free()

# --- Lifecycle ---
func _ready() -> void:
	add_to_group("regions")

	lifetime = minf(config.base_lifetime + _wave_number * config.lifetime_scaling, config.max_lifetime)
	hp = config.base_hp + _wave_number * config.hp_scaling
	max_hp = hp
	region_radius = minf(config.base_radius + _wave_number * config.radius_scaling, config.max_radius)
	spawn_interval = maxf(config.base_spawn_interval - _wave_number * config.spawn_interval_scaling, config.min_spawn_interval)
	burst_arc_center = _random_arc_center()

	# resource_local_to_scene = true on the shape so each instance gets its own.
	(collision_shape.shape as CircleShape2D).radius = region_radius

	spawn_timer.wait_time = spawn_interval
	spawn_timer.timeout.connect(_on_spawn_timer_timeout)
	spawn_timer.start(spawn_interval * 0.5)

func _process(delta: float) -> void:
	age += delta
	if age >= lifetime:
		queue_free()
		return
	queue_redraw()

func _on_spawn_timer_timeout() -> void:
	var offset_angle: float = randf() * TAU
	var offset_dist: float = randf() * region_radius
	var spawn_pos: Vector2 = global_position + Vector2.from_angle(offset_angle) * offset_dist
	spawn_requested.emit(spawn_pos, _spawn_momentum())
	spawn_timer.start(spawn_interval)

func _spawn_momentum() -> Vector2:
	if config.burst_speed <= 0.0:
		return Vector2.ZERO
	var burst_angle: float = burst_arc_center + (randf() * 2.0 - 1.0) * (config.burst_arc_width / 2.0)
	var speed: float = config.burst_speed * (0.5 + randf() * 0.5)
	return Vector2.from_angle(burst_angle) * speed

func _random_arc_center() -> float:
	var slack: float = config.burst_valid_range_width / 2.0 - config.burst_arc_width / 2.0
	if slack <= 0.0:
		return config.burst_valid_range_center
	return config.burst_valid_range_center + (randf() * 2.0 - 1.0) * slack

func _draw() -> void:
	var hp_ratio: float = float(hp) / float(max_hp) if max_hp > 0 else 1.0
	var pulse: float = sin(age * 4.0) * 0.15 + 0.85
	var alpha: float = (0.3 + 0.3 * hp_ratio) * pulse

	draw_circle(Vector2.ZERO, region_radius, Color(config.fill_color, alpha))
	draw_arc(Vector2.ZERO, region_radius, 0, TAU, 32, Color(config.stroke_color, alpha * 1.5), 2.0)
	DrawUtils.draw_bar(self, 0.0, -region_radius - 10.0, region_radius * 1.5, 4.0, hp_ratio, config.stroke_color)
