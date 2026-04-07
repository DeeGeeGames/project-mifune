extends Node2D
# Shared base for stationary armed units (Turret, Soldier). Owns ammo, fire
# cooldown, runner-claim API, in-range enemy cache, and the shared fire
# routine. Bullet spawns go through GameManager.request_bullet_spawn.
class_name Defender

var ammo: int = 0
var can_fire: bool = true
var enemies_in_range: Array[EnemyBase] = []
var claimed_by_runner: Node2D = null
var _prev_ammo: int = 0

@onready var range_area: Area2D = $RangeArea
@onready var fire_timer: Timer = $FireTimer

# --- Subclass overrides (config-derived) ---
func _max_ammo() -> int:
	return 0

func _reload_threshold() -> int:
	return 0

func _fire_rate() -> float:
	return 1.0

func _barrel_length() -> float:
	return 0.0

func _spread() -> float:
	return 0.0

# --- Lifecycle ---
func _ready() -> void:
	ammo = _max_ammo()
	_prev_ammo = ammo
	fire_timer.wait_time = 1.0 / _fire_rate()
	fire_timer.one_shot = true
	fire_timer.timeout.connect(_on_fire_timer_timeout)
	range_area.body_entered.connect(_on_range_body_entered)
	range_area.body_exited.connect(_on_range_body_exited)
	tree_exiting.connect(_on_tree_exiting)
	if needs_ammo():
		JobBoard.mark_needs_ammo(self)

func _on_tree_exiting() -> void:
	JobBoard.mark_ammo_filled(self)

# --- Ammo / claim API ---
func needs_ammo() -> bool:
	return ammo <= _reload_threshold()

func reload(amount: int) -> void:
	var was_needing: bool = needs_ammo()
	ammo = mini(_max_ammo(), ammo + amount)
	if was_needing and not needs_ammo():
		JobBoard.mark_ammo_filled(self)

func claim(runner: Node2D) -> void:
	claimed_by_runner = runner

func unclaim() -> void:
	claimed_by_runner = null

func is_claimed() -> bool:
	return claimed_by_runner != null

# --- Firing ---
func _try_fire(aim_angle: float) -> void:
	if not can_fire or ammo <= 0:
		return

	var was_needing: bool = needs_ammo()
	ammo -= 1
	if not was_needing and needs_ammo():
		JobBoard.mark_needs_ammo(self)
	can_fire = false
	fire_timer.start()

	var direction: Vector2 = Vector2.from_angle(aim_angle)
	var barrel_tip: Vector2 = global_position + direction * _barrel_length()
	var spread_angle: float = aim_angle + (randf() - 0.5) * _spread() * 2.0
	var bullet_vel: Vector2 = Vector2.from_angle(spread_angle) * Constants.BULLET_SPEED
	GameManager.request_bullet_spawn(barrel_tip, bullet_vel)

# --- Range tracking ---
func _on_range_body_entered(body: Node2D) -> void:
	if body is EnemyBase:
		enemies_in_range.append(body)
		# body_exited may not fire on queue_free, so listen for tree_exiting too.
		body.tree_exiting.connect(_on_tracked_enemy_exiting.bind(body), CONNECT_ONE_SHOT)

func _on_range_body_exited(body: Node2D) -> void:
	if body is EnemyBase:
		enemies_in_range.erase(body)

func _on_tracked_enemy_exiting(body: EnemyBase) -> void:
	enemies_in_range.erase(body)

func _on_fire_timer_timeout() -> void:
	can_fire = true
