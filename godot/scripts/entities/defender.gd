extends Node2D
# Shared base for stationary armed units (Turret, Soldier). Owns ammo, fire
# cooldown, runner-claim API, and the shared fire routine. Enemy proximity
# tracking is delegated to a TrackingArea child node ("RangeArea"). Bullet
# spawns go through GameManager.request_bullet_spawn.
# Subclasses set max_ammo / reload_threshold / fire_rate / barrel_length /
# spread from their own config before calling super._ready().
class_name Defender

var max_ammo: int = 0
var reload_threshold: int = 0
var fire_rate: float = 1.0
var barrel_length: float = 0.0
var spread: float = 0.0

var ammo: int = 0
var can_fire: bool = true
var claimed_by_runner: Node2D = null
var _prev_ammo: int = 0

@onready var range_area: TrackingArea = $RangeArea
@onready var fire_timer: Timer = $FireTimer

# --- Lifecycle ---
func _ready() -> void:
	ammo = max_ammo
	_prev_ammo = ammo
	fire_timer.wait_time = 1.0 / fire_rate
	fire_timer.one_shot = true
	fire_timer.timeout.connect(_on_fire_timer_timeout)
	tree_exiting.connect(_on_tree_exiting)
	if needs_ammo():
		JobBoard.mark_needs_ammo(self)

func _on_tree_exiting() -> void:
	JobBoard.mark_ammo_filled(self)

# --- Ammo / claim API ---
func needs_ammo() -> bool:
	return ammo <= reload_threshold

func reload(amount: int) -> void:
	var was_needing: bool = needs_ammo()
	ammo = mini(max_ammo, ammo + amount)
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
	var barrel_tip: Vector2 = global_position + direction * barrel_length
	var spread_angle: float = aim_angle + (randf() - 0.5) * spread * 2.0
	var bullet_vel: Vector2 = Vector2.from_angle(spread_angle) * Constants.BULLET_SPEED
	GameManager.request_bullet_spawn(barrel_tip, bullet_vel)

func _on_fire_timer_timeout() -> void:
	can_fire = true
