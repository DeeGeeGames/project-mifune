extends Resource
class_name RegionConfig

@export var base_lifetime: float = 2.0
@export var lifetime_scaling: float = 1.0
@export var max_lifetime: float = 24.0
@export var base_hp: int = 32
@export var hp_scaling: int = 8
@export var base_radius: float = 80.0
@export var radius_scaling: float = 4.0
@export var max_radius: float = 150.0
@export var base_spawn_interval: float = 0.2
@export var spawn_interval_scaling: float = 0.06
@export var min_spawn_interval: float = 0.08
@export var burst_arc_width: float = 0.7853982  # PI/4
@export var burst_valid_range_center: float = -1.5707963  # -PI/2
@export var burst_valid_range_width: float = 3.1415927  # PI
