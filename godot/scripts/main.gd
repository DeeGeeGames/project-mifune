extends Node2D

const RESOURCE_SCENE: PackedScene = preload("res://scenes/entities/resource_pickup.tscn")
const RUNNER_SCENE: PackedScene = preload("res://scenes/entities/runner.tscn")
const BULLET_SCENE: PackedScene = preload("res://scenes/entities/bullet.tscn")
const ENEMY_SCENE: PackedScene = preload("res://scenes/entities/enemy.tscn")
const SPAWN_REGION_SCENE: PackedScene = preload("res://scenes/entities/spawn_region.tscn")

@onready var resources_container: Node2D = $World/Resources
@onready var runners_container: Node2D = $World/Runners
@onready var bullets_container: Node2D = $World/Bullets
@onready var enemies_container: Node2D = $World/Enemies
@onready var regions_container: Node2D = $World/SpawnRegions

func _ready() -> void:
	GameManager.runner_purchased.connect(_on_runner_purchased)
	GameManager.region_spawn_requested.connect(_on_region_spawn_requested)
	$PlacementManager.turret_placed.connect(_on_turret_placed)
	$PlacementManager.block_placed.connect(_on_block_placed)

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

func _on_bullet_spawn_requested(pos: Vector2, vel: Vector2) -> void:
	var bullet: Bullet = BULLET_SCENE.instantiate()
	bullet.initialize(pos, vel)
	bullets_container.add_child(bullet)

func _on_turret_placed(turret: Turret) -> void:
	turret.fired.connect(_on_bullet_spawn_requested)
	$World/Turrets.add_child(turret)

func _on_block_placed(block: Block) -> void:
	block.destroyed.connect(_on_block_destroyed)
	$World/Blocks.add_child(block)

func _on_enemy_spawn_requested(pos: Vector2, momentum: Vector2) -> void:
	var enemy: Enemy = ENEMY_SCENE.instantiate()
	enemy.initialize(pos, momentum)
	enemy.died.connect(_on_enemy_died)
	enemies_container.add_child(enemy)

func _on_region_spawn_requested(pos: Vector2, wave_number: int) -> void:
	var region: SpawnRegion = SPAWN_REGION_SCENE.instantiate()
	region.position = pos
	region.initialize(wave_number)
	region.enemy_requested.connect(_on_enemy_spawn_requested)
	regions_container.add_child(region)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("fire"):
		if GameManager.control_mode == GameManagerClass.ControlMode.NONE and GameManager.placement_state == GameManagerClass.PlacementState.IDLE:
			var world_pos: Vector2 = get_global_mouse_position()
			var clicked_turret: Node2D = _find_clicked_turret(world_pos)
			if clicked_turret != null:
				GameManager.set_control_mode(GameManagerClass.ControlMode.SINGLE, clicked_turret.get_instance_id())
				get_viewport().set_input_as_handled()

func _find_clicked_turret(world_pos: Vector2) -> Node2D:
	for turret: Node in get_tree().get_nodes_in_group("turrets"):
		if turret is Turret and world_pos.distance_to(turret.global_position) <= (turret as Turret).config.radius * 1.5:
			return turret
	return null
