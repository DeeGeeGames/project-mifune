extends Node2D

const RESOURCE_SCENE: PackedScene = preload("res://scenes/entities/resource_pickup.tscn")
const RUNNER_SCENE: PackedScene = preload("res://scenes/entities/runner.tscn")
const BULLET_SCENE: PackedScene = preload("res://scenes/entities/bullet.tscn")
const ENEMY_SCENE: PackedScene = preload("res://scenes/entities/enemy.tscn")
const WALKER_SCENE: PackedScene = preload("res://scenes/entities/walker.tscn")
const SPAWN_REGION_SCENE: PackedScene = preload("res://scenes/entities/spawn_region.tscn")
const WALKER_SPAWNER_SCENE: PackedScene = preload("res://scenes/entities/walker_spawner.tscn")

@onready var resources_container: Node2D = $World/Resources
@onready var runners_container: Node2D = $World/Runners
@onready var bullets_container: Node2D = $World/Bullets
@onready var enemies_container: Node2D = $World/Enemies
@onready var regions_container: Node2D = $World/SpawnRegions
@onready var soldiers_container: Node2D = $World/Soldiers
@onready var wave_manager: Node = $WaveManager

func _ready() -> void:
	GameManager.runner_purchased.connect(_on_runner_purchased)
	GameManager.region_spawn_requested.connect(_on_region_spawn_requested)
	GameManager.walker_region_spawn_requested.connect(_on_walker_region_spawn_requested)
	GameManager.bullet_spawn_requested.connect(_on_bullet_spawn_requested)
	GameManager.resource_drop_requested.connect(_on_resource_drop_requested)
	$PlacementManager.turret_placed.connect(_on_turret_placed)
	$PlacementManager.block_placed.connect(_on_block_placed)
	$PlacementManager.soldier_placed.connect(_on_soldier_placed)

	for i: int in Constants.STARTING_RUNNERS:
		_spawn_runner()

func _on_resource_drop_requested(pos: Vector2) -> void:
	# Deferred so the Area2D's monitoring activates after the current physics
	# flush — death is signaled from inside a collision callback chain, and
	# adding an Area2D mid-flush trips area_set_shape_disabled.
	var resource: ResourcePickup = RESOURCE_SCENE.instantiate()
	resource.position = Vector2(pos.x, Constants.GROUND_Y)
	resources_container.add_child.call_deferred(resource)

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
	$World/Turrets.add_child(turret)

func _on_block_placed(block: Block) -> void:
	block.destroyed.connect(_on_block_destroyed)
	$World/Blocks.add_child(block)

func _on_soldier_placed(soldier: Soldier) -> void:
	soldiers_container.add_child(soldier)

func _on_enemy_spawn_requested(pos: Vector2, momentum: Vector2) -> void:
	var enemy: Enemy = ENEMY_SCENE.instantiate()
	enemy.initialize(pos, momentum)
	enemy.tree_exiting.connect(wave_manager.on_enemy_despawned)
	enemies_container.add_child(enemy)
	wave_manager.on_enemy_spawned()

func _on_region_spawn_requested(pos: Vector2, wave_number: int) -> void:
	var region: SpawnRegion = SPAWN_REGION_SCENE.instantiate()
	region.position = pos
	region.initialize(wave_number)
	region.enemy_requested.connect(_on_enemy_spawn_requested)
	region.tree_exiting.connect(wave_manager.on_region_despawned)
	regions_container.add_child(region)
	wave_manager.on_region_spawned()

func _on_walker_spawn_requested(pos: Vector2) -> void:
	var walker: Walker = WALKER_SCENE.instantiate()
	walker.initialize(pos)
	walker.tree_exiting.connect(wave_manager.on_enemy_despawned)
	enemies_container.add_child(walker)
	wave_manager.on_enemy_spawned()

func _on_walker_region_spawn_requested(pos: Vector2, wave_number: int) -> void:
	var spawner: WalkerSpawner = WALKER_SPAWNER_SCENE.instantiate()
	spawner.position = pos
	spawner.initialize(wave_number)
	spawner.walker_requested.connect(_on_walker_spawn_requested)
	spawner.tree_exiting.connect(wave_manager.on_region_despawned)
	regions_container.add_child(spawner)
	wave_manager.on_region_spawned()
