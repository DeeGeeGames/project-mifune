extends Area2D
# Shared base for enemy-producing regions (SpawnRegion, WalkerSpawner). Owns
# wave-scaled params, HP / lifetime, the collision shape sizing, and the spawn
# cadence timer. Subclasses override the spawn emission with their own burst
# or ballistic behavior.
class_name SpawnerBase

var hp: int = 0
var max_hp: int = 0
var lifetime: float = 0.0
var age: float = 0.0
var region_radius: float = 0.0
var spawn_interval: float = 0.0
var _wave_number: int = 1

@onready var spawn_timer: Timer = $SpawnTimer
@onready var collision_shape: CollisionShape2D = $CollisionShape2D

# --- Subclass overrides ---
func _base_lifetime() -> float:
	return 0.0

func _lifetime_scaling() -> float:
	return 0.0

func _max_lifetime() -> float:
	return 0.0

func _base_hp() -> int:
	return 0

func _hp_scaling() -> int:
	return 0

func _base_radius() -> float:
	return 0.0

func _radius_scaling() -> float:
	return 0.0

func _max_radius() -> float:
	return 0.0

func _base_spawn_interval() -> float:
	return 0.0

func _spawn_interval_scaling() -> float:
	return 0.0

func _min_spawn_interval() -> float:
	return 0.0

func _emit_spawn(_spawn_pos: Vector2) -> void:
	pass

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

	lifetime = minf(_base_lifetime() + _wave_number * _lifetime_scaling(), _max_lifetime())
	hp = _base_hp() + _wave_number * _hp_scaling()
	max_hp = hp
	region_radius = minf(_base_radius() + _wave_number * _radius_scaling(), _max_radius())
	spawn_interval = maxf(_base_spawn_interval() - _wave_number * _spawn_interval_scaling(), _min_spawn_interval())

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
	_emit_spawn(spawn_pos)
	spawn_timer.start(spawn_interval)
