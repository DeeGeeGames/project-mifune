extends Camera2D

var is_panning: bool = false
var pan_start: Vector2 = Vector2.ZERO
var camera_start: Vector2 = Vector2.ZERO

func _ready() -> void:
	# Don't use Godot's built-in limits — they fight with zoom-toward-cursor math.
	# We clamp manually in _clamp_position() instead.
	limit_left = -10000000
	limit_top = -10000000
	limit_right = 10000000
	limit_bottom = 10000000
	position = Constants.TARGET_POS
	zoom = Vector2(Constants.INITIAL_ZOOM, Constants.INITIAL_ZOOM)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pan_camera"):
		is_panning = true
		pan_start = (event as InputEventMouseButton).position
		camera_start = position
		get_viewport().set_input_as_handled()
	elif event.is_action_released("pan_camera"):
		is_panning = false
	elif event is InputEventMouseMotion and is_panning:
		_handle_pan_motion(event as InputEventMouseMotion)
	elif event.is_action_pressed("zoom_in") or event.is_action_pressed("zoom_out"):
		if GameManager.placement_state["tag"] == "aiming":
			var dy: float = 1.0 if event.is_action_pressed("zoom_out") else -1.0
			_adjust_arc_width(dy)
			get_viewport().set_input_as_handled()
			return
		_handle_zoom(event as InputEventMouseButton)

func _handle_pan_motion(event: InputEventMouseMotion) -> void:
	var delta_screen: Vector2 = pan_start - event.position
	position = camera_start + delta_screen / zoom.x
	get_viewport().set_input_as_handled()

func _handle_zoom(event: InputEventMouseButton) -> void:
	var old_zoom: float = zoom.x
	var direction: float = 1.0 if event.is_action("zoom_in") else -1.0
	var new_zoom: float = clampf(old_zoom + direction * Constants.ZOOM_STEP * old_zoom, Constants.ZOOM_MIN, Constants.ZOOM_MAX)

	# Zoom toward cursor
	var viewport_size: Vector2 = get_viewport_rect().size
	var sx: float = event.position.x - viewport_size.x / 2.0
	var sy: float = event.position.y - viewport_size.y / 2.0
	position.x += sx * (1.0 / old_zoom - 1.0 / new_zoom)
	position.y += sy * (1.0 / old_zoom - 1.0 / new_zoom)
	zoom = Vector2(new_zoom, new_zoom)

func _adjust_arc_width(dy: float) -> void:
	var ps: Dictionary[String, Variant] = GameManager.placement_state
	if ps["tag"] != "aiming":
		return
	var direction: float = -1.0 if dy < 0 else 1.0
	var arc_range: Dictionary[String, Variant] = ps["arc_range"] as Dictionary[String, Variant]
	var new_width: float = clampf(
		ps["arc_width"] as float + direction * Constants.ARC_SCROLL_STEP,
		Constants.ARC_WIDTH_MIN,
		arc_range["width"],
	)
	var updated: Dictionary[String, Variant] = ps.duplicate()
	updated["arc_width"] = new_width
	GameManager.set_placement_state(updated)

func _process(delta: float) -> void:
	# Keyboard panning
	var pan_dir: Vector2 = Vector2.ZERO
	if Input.is_action_pressed("pan_left"):
		pan_dir.x -= 1.0
	if Input.is_action_pressed("pan_right"):
		pan_dir.x += 1.0
	if Input.is_action_pressed("pan_up"):
		pan_dir.y -= 1.0
	if Input.is_action_pressed("pan_down"):
		pan_dir.y += 1.0

	if pan_dir != Vector2.ZERO:
		position += pan_dir * Constants.PAN_SPEED * delta / zoom.x

	_clamp_position()

func _clamp_position() -> void:
	var viewport_size: Vector2 = get_viewport_rect().size
	var half_view: Vector2 = viewport_size / (2.0 * zoom.x)
	position.x = clampf(position.x, half_view.x, Constants.WORLD_WIDTH - half_view.x)
	position.y = clampf(position.y, half_view.y, Constants.WORLD_HEIGHT - half_view.y)
