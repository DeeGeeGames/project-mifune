extends Area2D
class_name Bullet

@export var config: BulletConfig = preload("res://resources/defaults/bullet_default.tres")

var velocity_vec: Vector2 = Vector2.ZERO
var damage: int = 0
var has_hit: bool = false

func _ready() -> void:
	damage = config.damage
	add_to_group("bullets")
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	$LifetimeTimer.timeout.connect(queue_free)

func initialize(pos: Vector2, vel: Vector2) -> void:
	position = pos
	velocity_vec = vel

func _physics_process(delta: float) -> void:
	position += velocity_vec * delta

func _on_body_entered(body: Node2D) -> void:
	if has_hit:
		return
	if body is EnemyBase:
		has_hit = true
		(body as EnemyBase).take_damage(damage)
		queue_free()

func _on_area_entered(area: Area2D) -> void:
	if has_hit:
		return
	if area is Spawner:
		has_hit = true
		(area as Spawner).take_damage(damage)
		queue_free()

func _draw() -> void:
	draw_circle(Vector2.ZERO, config.radius, Color(1.0, 1.0, 0.0))
