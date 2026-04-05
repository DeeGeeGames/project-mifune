extends Node2D

@onready var world: Node2D = $World
@onready var enemies_container: Node2D = $World/Enemies
@onready var regions_container: Node2D = $World/SpawnRegions
@onready var turrets_container: Node2D = $World/Turrets
@onready var runners_container: Node2D = $World/Runners
@onready var bullets_container: Node2D = $World/Bullets
@onready var resources_container: Node2D = $World/Resources
@onready var blocks_container: Node2D = $World/Blocks
@onready var game_camera: Camera2D = $Camera
@onready var placement_manager: Node2D = $PlacementManager

const RESOURCE_SCENE: PackedScene = preload("res://scenes/entities/resource_pickup.tscn")
const RUNNER_SCENE: PackedScene = preload("res://scenes/entities/runner.tscn")

func _ready() -> void:
	# Wire up GameManager container references
	GameManager.enemies_container = enemies_container
	GameManager.regions_container = regions_container
	GameManager.turrets_container = turrets_container
	GameManager.runners_container = runners_container
	GameManager.bullets_container = bullets_container
	GameManager.resources_container = resources_container
	GameManager.blocks_container = blocks_container

	# Connect signals
	GameManager.enemy_died.connect(_on_enemy_died)
	GameManager.runner_purchased.connect(_on_runner_purchased)
	GameManager.block_destroyed.connect(_on_block_destroyed)

	# Spawn starting runners
	for i: int in Constants.STARTING_RUNNERS:
		_spawn_runner()

func _on_enemy_died(pos: Vector2) -> void:
	var resource: ResourcePickup = RESOURCE_SCENE.instantiate()
	resource.position = Vector2(pos.x, Constants.GROUND_Y)
	resources_container.add_child(resource)

func _on_runner_purchased() -> void:
	_spawn_runner()

func _spawn_runner() -> void:
	var runner: Runner = RUNNER_SCENE.instantiate()
	runner.position = Constants.TARGET_POS
	runners_container.add_child(runner)

func _on_block_destroyed(block_id: int) -> void:
	for turret: Node in get_tree().get_nodes_in_group("turrets"):
		if turret is Turret and (turret as Turret).parent_block_id == block_id:
			turret.queue_free()

func get_mouse_world_position() -> Vector2:
	return get_global_mouse_position()

func _unhandled_input(event: InputEvent) -> void:
	if GameManager.game_over:
		return

	# Click on turret to enter single control mode
	if event.is_action_pressed("fire"):
		if GameManager.control_mode["tag"] == "none" and GameManager.placement_state["tag"] == "idle":
			var world_pos: Vector2 = get_global_mouse_position()
			var clicked_turret: Node2D = _find_clicked_turret(world_pos)
			if clicked_turret != null:
				GameManager.set_control_mode({ "tag": "single", "turret_id": clicked_turret.get_instance_id() })
				get_viewport().set_input_as_handled()

func _find_clicked_turret(world_pos: Vector2) -> Node2D:
	for turret: Node in get_tree().get_nodes_in_group("turrets"):
		if world_pos.distance_to(turret.global_position) <= Constants.TURRET_RADIUS * 1.5:
			return turret
	return null
