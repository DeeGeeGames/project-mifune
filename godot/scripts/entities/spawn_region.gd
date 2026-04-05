extends Area2D
class_name SpawnRegion

const ENEMY_SCENE: PackedScene = preload("res://scenes/entities/enemy.tscn")

var hp: int = 0
var max_hp: int = 0
var lifetime: float = 0.0
var age: float = 0.0
var region_radius: float = 0.0
var spawn_interval: float = 0.0
var burst_arc_center: float = 0.0
var burst_arc_width: float = Constants.REGION_BURST_ARC_WIDTH
var _wave_number: int = 1

@onready var spawn_timer: Timer = $SpawnTimer

func initialize(wave_number: int) -> void:
	_wave_number = wave_number

func _ready() -> void:
	add_to_group("regions")
	collision_layer = 1 << (Constants.LAYER_ENEMIES - 1)  # So bullets hit us
	collision_mask = 0

	# Compute wave-scaled params
	lifetime = minf(Constants.REGION_BASE_LIFETIME + _wave_number * Constants.REGION_LIFETIME_SCALING, Constants.REGION_MAX_LIFETIME)
	hp = Constants.REGION_BASE_HP + _wave_number * Constants.REGION_HP_SCALING
	max_hp = hp
	region_radius = minf(Constants.REGION_BASE_RADIUS + _wave_number * Constants.REGION_RADIUS_SCALING, Constants.REGION_MAX_RADIUS)
	spawn_interval = maxf(Constants.REGION_BASE_SPAWN_INTERVAL - _wave_number * Constants.REGION_SPAWN_INTERVAL_SCALING, Constants.REGION_MIN_SPAWN_INTERVAL)
	burst_arc_center = _random_arc_center(Constants.REGION_BURST_ARC_WIDTH, Constants.REGION_BURST_VALID_RANGE_CENTER, Constants.REGION_BURST_VALID_RANGE_WIDTH)
	burst_arc_width = Constants.REGION_BURST_ARC_WIDTH

	# Set up collision shape
	var shape := CircleShape2D.new()
	shape.radius = region_radius
	var collision := CollisionShape2D.new()
	collision.shape = shape
	add_child(collision)

	# Start spawning with initial half-interval delay
	spawn_timer.wait_time = spawn_interval
	spawn_timer.timeout.connect(_on_spawn_timer_timeout)
	spawn_timer.start(spawn_interval * 0.5)

func _random_arc_center(arc_w: float, valid_center: float, valid_width: float) -> float:
	var slack: float = valid_width / 2.0 - arc_w / 2.0
	if slack <= 0.0:
		return valid_center
	return valid_center + (randf() * 2.0 - 1.0) * slack

func take_damage(amount: int) -> void:
	hp -= amount
	if hp <= 0:
		queue_free()

func _process(delta: float) -> void:
	age += delta
	if age >= lifetime:
		queue_free()
		return
	queue_redraw()

func _on_spawn_timer_timeout() -> void:
	_spawn_enemy()
	spawn_timer.start(spawn_interval)

func _spawn_enemy() -> void:
	var enemies_container: Node = get_node_or_null("/root/Main/World/Enemies")
	if enemies_container == null:
		return

	var offset_angle: float = randf() * TAU
	var offset_dist: float = randf() * region_radius
	var spawn_pos: Vector2 = global_position + Vector2(cos(offset_angle), sin(offset_angle)) * offset_dist

	var burst_angle: float = burst_arc_center + (randf() * 2.0 - 1.0) * (burst_arc_width / 2.0)
	var burst_speed: float = Constants.ENEMY_SPAWN_BURST_SPEED * (0.5 + randf() * 0.5)
	var momentum: Vector2 = Vector2(cos(burst_angle), sin(burst_angle)) * burst_speed

	var enemy: Enemy = ENEMY_SCENE.instantiate()
	enemy.initialize(spawn_pos, momentum)
	enemies_container.add_child(enemy)

func _draw() -> void:
	var hp_ratio: float = float(hp) / float(max_hp) if max_hp > 0 else 1.0
	var pulse: float = sin(age * 4.0) * 0.15 + 0.85
	var alpha: float = (0.3 + 0.3 * hp_ratio) * pulse

	# Region circle
	var color: Color = Color(0.8, 0.2, 0.8, alpha)
	draw_circle(Vector2.ZERO, region_radius, color)
	draw_arc(Vector2.ZERO, region_radius, 0, TAU, 32, Color(1.0, 0.3, 1.0, alpha * 1.5), 2.0)

	# HP bar
	DrawUtils.draw_bar(self, 0.0, -region_radius - 10.0, region_radius * 1.5, 4.0, hp_ratio, Color(1.0, 0.3, 1.0))
