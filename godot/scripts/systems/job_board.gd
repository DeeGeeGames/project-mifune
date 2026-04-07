extends Node
# Signal-driven task registry. Replaces per-frame group polling for runners
# searching for resources or units that need ammo. Producers (ResourcePickup,
# Defender) push availability events; consumers (Runner) pull the nearest
# matching job and atomically claim it.
class_name JobBoardClass

var _available_resources: Array[ResourcePickup] = []
var _ammo_needs: Array[Defender] = []

# --- Resources ---
func register_resource(r: ResourcePickup) -> void:
	if r not in _available_resources:
		_available_resources.append(r)

func unregister_resource(r: ResourcePickup) -> void:
	_available_resources.erase(r)

func take_nearest_resource(from: Vector2, runner: Node2D) -> ResourcePickup:
	var nearest: ResourcePickup = null
	var nearest_dist: float = INF
	for r: ResourcePickup in _available_resources:
		if r.is_claimed() and r.claimed_by_runner != runner:
			continue
		var dist: float = from.distance_to(r.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = r
	if nearest != null:
		nearest.claim(runner)
	return nearest

# --- Ammo jobs ---
func mark_needs_ammo(unit: Defender) -> void:
	if unit not in _ammo_needs:
		_ammo_needs.append(unit)

func mark_ammo_filled(unit: Defender) -> void:
	_ammo_needs.erase(unit)

func take_nearest_ammo_job(from: Vector2, runner: Node2D) -> Defender:
	var nearest: Defender = null
	var nearest_dist: float = INF
	for unit: Defender in _ammo_needs:
		if unit.is_claimed():
			continue
		var dist: float = from.distance_to(unit.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = unit
	if nearest != null:
		nearest.claim(runner)
	return nearest
