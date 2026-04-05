extends Node2D

const TURRET_SCENE: PackedScene = preload("res://scenes/entities/turret.tscn")
const BLOCK_SCENE: PackedScene = preload("res://scenes/entities/block.tscn")

func _ready() -> void:
	z_index = 10

func _unhandled_input(event: InputEvent) -> void:
	if GameManager.game_over:
		return

	if event.is_action_pressed("fire"):
		_handle_click(get_global_mouse_position())

func _handle_click(world_pos: Vector2) -> void:
	var ps: Dictionary[String, Variant] = GameManager.placement_state
	var tag: String = ps["tag"] as String

	match tag:
		"placing_turret":
			_handle_turret_placement_click(world_pos)
		"aiming":
			_handle_aiming_confirm(world_pos, ps)
		"placing_block":
			_handle_block_placement_click(world_pos)

func _handle_turret_placement_click(world_pos: Vector2) -> void:
	if GameManager.currency < Constants.TURRET_COST:
		return

	# Check block face first
	var face_result: Variant = _find_clicked_block_face(world_pos)
	if face_result != null:
		var face_dict: Dictionary[String, Variant] = face_result as Dictionary[String, Variant]
		var face_pos: Vector2 = face_dict["position"] as Vector2
		var face_arc_range: Dictionary[String, Variant] = face_dict["arc_range"] as Dictionary[String, Variant]
		var block_id: int = face_dict["block_id"] as int
		GameManager.set_placement_state({
			"tag": "aiming",
			"position": face_pos,
			"arc_width": minf(Constants.ARC_WIDTH_DEFAULT, face_arc_range["width"]),
			"arc_range": face_arc_range,
			"parent_block_id": block_id,
		})
		return

	# Check valid ground placement
	if _is_valid_ground_placement(world_pos):
		var ground_pos: Vector2 = Vector2(world_pos.x, Constants.GROUND_Y)
		GameManager.set_placement_state({
			"tag": "aiming",
			"position": ground_pos,
			"arc_width": minf(Constants.ARC_WIDTH_DEFAULT, Constants.GROUND_ARC_RANGE["width"]),
			"arc_range": Constants.GROUND_ARC_RANGE,
			"parent_block_id": -1,
		})

func _handle_aiming_confirm(world_pos: Vector2, ps: Dictionary[String, Variant]) -> void:
	var turret_pos: Vector2 = ps["position"] as Vector2
	var arc_range: Dictionary[String, Variant] = ps["arc_range"] as Dictionary[String, Variant]
	var raw_center: float = Targeting.aim_angle(turret_pos, world_pos)
	var arc_center: float = Targeting.clamp_arc_center_to_range(
		raw_center,
		ps["arc_width"] as float,
		arc_range["center"],
		arc_range["width"],
	)

	var turret: Turret = TURRET_SCENE.instantiate()
	turret.initialize(turret_pos, arc_center, ps["arc_width"] as float, ps["arc_range"] as Dictionary[String, Variant], ps["parent_block_id"] as int)
	GameManager.turrets_container.add_child(turret)
	GameManager.spend_currency(Constants.TURRET_COST)

	if GameManager.currency >= Constants.TURRET_COST:
		GameManager.set_placement_state({ "tag": "placing_turret" })
	else:
		GameManager.set_placement_state({ "tag": "idle" })

func _handle_block_placement_click(world_pos: Vector2) -> void:
	if GameManager.currency < Constants.BLOCK_COST:
		return

	var snapped: Vector2 = _snap_to_block_grid(world_pos)
	var half: float = Constants.BLOCK_HALF

	# Check cursor is near snapped position
	if absf(snapped.x - world_pos.x) > half or absf(snapped.y - world_pos.y) > half:
		return

	if not _is_valid_block_placement(snapped):
		return

	var block: Block = BLOCK_SCENE.instantiate()
	block.initialize(snapped)
	GameManager.blocks_container.add_child(block)
	GameManager.spend_currency(Constants.BLOCK_COST)

	if GameManager.currency < Constants.BLOCK_COST:
		GameManager.set_placement_state({ "tag": "idle" })

# --- Block grid snapping ---
func _snap_to_block_grid(world_pos: Vector2) -> Vector2:
	var blocks: Array[Node] = get_tree().get_nodes_in_group("blocks")

	if blocks.size() > 0:
		var best_pos: Vector2 = Vector2.ZERO
		var best_dist: float = INF

		for block: Node2D in blocks:
			var offsets: Array[Vector2] = [Vector2(0, -Constants.BLOCK_SIZE), Vector2(0, Constants.BLOCK_SIZE), Vector2(-Constants.BLOCK_SIZE, 0), Vector2(Constants.BLOCK_SIZE, 0)]
			for offset: Vector2 in offsets:
				var candidate: Vector2 = block.position + offset
				if _has_block_at(candidate, blocks):
					continue
				var dist: float = world_pos.distance_to(candidate)
				if dist < best_dist:
					best_dist = dist
					best_pos = candidate

		if best_dist < Constants.BLOCK_SIZE * 1.5:
			return best_pos

	var column_x: float = roundf(world_pos.x / Constants.BLOCK_SIZE) * Constants.BLOCK_SIZE
	return Vector2(column_x, Constants.GROUND_Y - Constants.BLOCK_HALF)

func _has_block_at(pos: Vector2, blocks: Array[Node]) -> bool:
	for block: Node in blocks:
		if absf(block.position.x - pos.x) < 1.0 and absf(block.position.y - pos.y) < 1.0:
			return true
	return false

func _is_valid_block_placement(snapped: Vector2) -> bool:
	if snapped.x < Constants.PLACEMENT_MIN_X or snapped.x > Constants.PLACEMENT_MAX_X:
		return false
	if snapped.y < 0.0:
		return false
	return not _has_block_at(snapped, get_tree().get_nodes_in_group("blocks"))

# --- Ground turret placement validation ---
func _is_valid_ground_placement(world_pos: Vector2) -> bool:
	if world_pos.x < Constants.PLACEMENT_MIN_X or world_pos.x > Constants.PLACEMENT_MAX_X:
		return false
	var snapped: Vector2 = Vector2(world_pos.x, Constants.GROUND_Y)
	for turret: Node in get_tree().get_nodes_in_group("turrets"):
		if turret.global_position.distance_to(snapped) <= Constants.TURRET_RADIUS * 2.5:
			return false
	return true

# --- Block face detection ---
func _find_clicked_block_face(click_pos: Vector2) -> Variant:
	var blocks: Array[Node] = get_tree().get_nodes_in_group("blocks")
	var half: float = Constants.BLOCK_HALF
	var best: Variant = null
	var best_dist: float = Constants.BLOCK_FACE_CLICK_THRESHOLD

	var face_defs: Array[Dictionary] = [
		{ "face": "top", "offset": Vector2(0, -half), "arc_range": Constants.GROUND_ARC_RANGE },
		{ "face": "left", "offset": Vector2(-half, 0), "arc_range": Constants.LEFT_FACE_ARC_RANGE },
		{ "face": "right", "offset": Vector2(half, 0), "arc_range": Constants.RIGHT_FACE_ARC_RANGE },
	]

	for block: Node in blocks:
		for face_def: Dictionary in face_defs:
			# Check if face is exposed (no adjacent block)
			var adj_offset: Vector2 = Vector2.ZERO
			match face_def["face"] as String:
				"top":
					adj_offset = Vector2(0, -Constants.BLOCK_SIZE)
				"left":
					adj_offset = Vector2(-Constants.BLOCK_SIZE, 0)
				"right":
					adj_offset = Vector2(Constants.BLOCK_SIZE, 0)
			if _has_block_at(block.position + adj_offset, blocks):
				continue

			var face_pos: Vector2 = block.position + (face_def["offset"] as Vector2)
			var dist: float = click_pos.distance_to(face_pos)
			if dist < best_dist:
				best_dist = dist
				best = {
					"position": face_pos,
					"arc_range": face_def["arc_range"],
					"block_id": block.block_id,
				}

	return best

# --- Drawing ghost previews ---
func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	var ps: Dictionary[String, Variant] = GameManager.placement_state
	var tag: String = ps["tag"] as String

	match tag:
		"placing_turret":
			_draw_turret_ghost()
		"aiming":
			_draw_aiming_preview(ps)
		"placing_block":
			_draw_block_ghost()

func _draw_turret_ghost() -> void:
	var world_pos: Vector2 = get_global_mouse_position()
	var local_pos: Vector2 = to_local(Vector2(world_pos.x, Constants.GROUND_Y))
	draw_circle(local_pos, Constants.TURRET_RADIUS, Color(0.0, 0.8, 0.0, 0.4))

func _draw_aiming_preview(ps: Dictionary[String, Variant]) -> void:
	var turret_pos: Vector2 = ps["position"] as Vector2
	var arc_range: Dictionary[String, Variant] = ps["arc_range"] as Dictionary[String, Variant]
	var arc_width: float = ps["arc_width"] as float
	var local_pos: Vector2 = to_local(turret_pos)
	var mouse_pos: Vector2 = get_global_mouse_position()
	var raw_center: float = Targeting.aim_angle(turret_pos, mouse_pos)
	var arc_center: float = Targeting.clamp_arc_center_to_range(
		raw_center, arc_width, arc_range["center"], arc_range["width"],
	)

	# Draw valid range (light gray)
	DrawUtils.draw_arc_wedge(self, local_pos, 80.0, arc_range["center"], arc_range["width"], Color(0.5, 0.5, 0.5, 0.15), 24)

	# Draw selected arc (cyan)
	DrawUtils.draw_arc_wedge(self, local_pos, 80.0, arc_center, arc_width, Color(0.0, 1.0, 1.0, 0.2), 24)

	# Ghost turret
	draw_circle(local_pos, Constants.TURRET_RADIUS, Color(0.0, 1.0, 1.0, 0.5))
	var barrel_end: Vector2 = local_pos + Vector2(cos(arc_center), sin(arc_center)) * Constants.TURRET_BARREL_LENGTH
	draw_line(local_pos, barrel_end, Color(0.0, 1.0, 1.0, 0.5), 3.0)

func _draw_block_ghost() -> void:
	var world_pos: Vector2 = get_global_mouse_position()
	var snapped: Vector2 = _snap_to_block_grid(world_pos)
	var local_pos: Vector2 = to_local(snapped)
	var half: float = Constants.BLOCK_HALF
	var valid: bool = _is_valid_block_placement(snapped)
	var color: Color = Color(0.0, 0.8, 0.0, 0.4) if valid else Color(1.0, 0.0, 0.0, 0.4)
	draw_rect(Rect2(local_pos.x - half, local_pos.y - half, Constants.BLOCK_SIZE, Constants.BLOCK_SIZE), color)

