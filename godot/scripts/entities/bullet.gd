extends Area2D
class_name Bullet

var velocity_vec: Vector2 = Vector2.ZERO
var damage: int = Constants.BULLET_DAMAGE
var has_hit: bool = false

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)

func initialize(pos: Vector2, vel: Vector2) -> void:
	position = pos
	velocity_vec = vel

func _physics_process(delta: float) -> void:
	position += velocity_vec * delta

	# Bounds check
	if position.x < -50.0 or position.x > Constants.WORLD_WIDTH + 50.0 \
		or position.y < -50.0 or position.y > Constants.WORLD_HEIGHT + 50.0:
		queue_free()

func _on_body_entered(body: Node2D) -> void:
	if has_hit:
		return
	if body is Enemy:
		has_hit = true
		(body as Enemy).take_damage(damage)
		queue_free()

func _on_area_entered(area: Area2D) -> void:
	if has_hit:
		return
	if area is SpawnRegion:
		has_hit = true
		(area as SpawnRegion).take_damage(damage)
		queue_free()

func _draw() -> void:
	draw_circle(Vector2.ZERO, Constants.BULLET_RADIUS, Color(1.0, 1.0, 0.0))
