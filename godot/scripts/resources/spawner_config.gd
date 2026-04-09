extends Resource
class_name SpawnerConfig

# Wave-scaled stats
@export var base_lifetime: float = 0.0
@export var lifetime_scaling: float = 0.0
@export var max_lifetime: float = 0.0
@export var base_hp: int = 0
@export var hp_scaling: int = 0
@export var base_radius: float = 0.0
@export var radius_scaling: float = 0.0
@export var max_radius: float = 0.0
@export var base_spawn_interval: float = 0.0
@export var spawn_interval_scaling: float = 0.0
@export var min_spawn_interval: float = 0.0

# Visual
@export var fill_color: Color = Color(0.8, 0.2, 0.8)
@export var stroke_color: Color = Color(1.0, 0.3, 1.0)

# Optional burst momentum. burst_speed <= 0 means spawned units get no
# launch momentum (walker-style); > 0 picks an angle inside an arc that's
# itself randomly placed inside burst_valid_range_* at _ready time.
@export var burst_speed: float = 0.0
@export var burst_arc_width: float = 0.0
@export var burst_valid_range_center: float = 0.0
@export var burst_valid_range_width: float = 0.0
