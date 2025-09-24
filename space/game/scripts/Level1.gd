# Level.gd — streamed craters with blue-noise spacing, hysteresis, and robust off-screen reveal
extends Node2D

# ---------- Tunables ----------
@export var chunk_size: int = 256            # smaller => more frequent chunk crossings
@export var cell_size: int = 350             # base spacing; one candidate per grid cell (increased for fewer craters)
@export var neighbor_radius_cells: int = 1   # 1..2; exclusion neighborhood for blue-noise
@export var jitter_ratio: float = 0.32       # 0..0.49; offset from grid center

@export var load_radius_chunks: int = 7      # preload ring radius
@export var keep_radius_chunks: int = 9      # unload beyond this (hysteresis)

@export var update_interval: float = 0.2    # seconds between stream checks
@export var fade_duration: float = 0.2      # seconds for fade in/out
@export var preload_margin_px: float = 1024.0 # off-screen margin for deciding visibility
@export var reveal_move_threshold_px: float = 640.0  # fail-safe: reveal if camera moved this far from spawn camera

# ---------- Scenes / Nodes ----------
var CraterScene: PackedScene = preload("res://scenes/LunarCrater.tscn")
@onready var actors: Node = _get_or_make_interactables()

# ---------- State ----------
var loaded_chunks := {}    # key -> Array[Node]
var last_chunk := Vector2i(999999, 999999)
var _accum := 0.0

# Pending reveal entries: { "node": Node, "anchor_cam": Vector2 }
var _pending_reveal: Array = []

func _ready() -> void:
	_update_stream(true)

func _process(dt: float) -> void:
	_accum += dt
	if _accum >= update_interval:
		_accum = 0.0
		_update_stream(false)
	_reveal_offscreen_spawns()

# ---------- Streaming w/ hysteresis ----------
func _update_stream(force: bool) -> void:
	var obs := _observer_position()
	var pc := _world_to_chunk(obs)
	if (not force) and pc == last_chunk:
		return
	last_chunk = pc

	var want_load := {}
	var keep := {}

	# Load ring
	for dy in range(-load_radius_chunks, load_radius_chunks + 1):
		for dx in range(-load_radius_chunks, load_radius_chunks + 1):
			var c := Vector2i(pc.x + dx, pc.y + dy)
			var key := _key(c)
			want_load[key] = true
			if not loaded_chunks.has(key):
				_spawn_chunk(c)

	# Keep (bigger) ring
	for dy in range(-keep_radius_chunks, keep_radius_chunks + 1):
		for dx in range(-keep_radius_chunks, keep_radius_chunks + 1):
			keep[_key(Vector2i(pc.x + dx, pc.y + dy))] = true

	# Despawn outside keep ring (with fade-out)
	var to_remove := []
	for key in loaded_chunks.keys():
		if not keep.has(key):
			to_remove.append(key)
	for key in to_remove:
		_despawn_chunk(key)

func _spawn_chunk(c: Vector2i) -> void:
	var key := _key(c)
	if loaded_chunks.has(key):
		return

	var instances: Array = []
	var half := chunk_size * 0.5
	var origin := Vector2(c.x * chunk_size, c.y * chunk_size)
	var cmin := origin - Vector2(half, half)
	var cmax := origin + Vector2(half, half)

	# Grid coverage (+1 cell border to avoid seams)
	var start_x := int(floor(cmin.x / cell_size)) * cell_size - cell_size
	var start_y := int(floor(cmin.y / cell_size)) * cell_size - cell_size
	var end_x   := int(ceil(cmax.x  / cell_size)) * cell_size + cell_size
	var end_y   := int(ceil(cmax.y  / cell_size)) * cell_size + cell_size

	var jitter : Variant = clamp(jitter_ratio, 0.0, 0.49) * float(cell_size)
	var screen_rect := _screen_world_rect(preload_margin_px)
	var cam := get_viewport().get_camera_2d()
	var cam_pos := cam.global_position if cam else Vector2.ZERO

	for y in range(start_y, end_y, cell_size):
		for x in range(start_x, end_x, cell_size):
			var center := Vector2(x + cell_size * 0.5, y + cell_size * 0.5)
			if not _in_rect(center, cmin, cmax):
				continue

			# Integer cell coords
			var ix := int(floor(float(x) / cell_size))
			var iy := int(floor(float(y) / cell_size))

			# Blue-noise neighborhood rule (local max)
			if not _is_local_max(ix, iy, neighbor_radius_cells):
				continue

			# Deterministic jitter + position
			var rng := RandomNumberGenerator.new()
			rng.seed = _hash(ix, iy)
			var pos := center + Vector2(
				rng.randf_range(-jitter, jitter),
				rng.randf_range(-jitter, jitter)
			)

			# Spawn crater
			var crater := CraterScene.instantiate()
			crater.global_position = pos
			actors.add_child(crater)
			instances.append(crater)

			# Visibility: never pop-in on-screen.
			if screen_rect.has_point(pos):
				crater.visible = false
				crater.modulate.a = 0.0
				_set_collision_enabled(crater, false, true)
				_pending_reveal.append({
					"node": crater,
					"anchor_cam": cam_pos   # camera position at spawn time (fail-safe distance check)
				})
			else:
				crater.visible = true
				crater.modulate.a = 0.0
				_set_collision_enabled(crater, true, true)
				_fade_in(crater)

	loaded_chunks[key] = instances

func _despawn_chunk(key: String) -> void:
	var arr: Array = loaded_chunks.get(key, [])
	if arr.size() > 0:
		# Remove any pending entries that belong to this chunk
		var keep_pending: Array = []
		for e in _pending_reveal:
			if is_instance_valid(e.get("node")) and not (arr.has(e.get("node"))):
				keep_pending.append(e)
		_pending_reveal = keep_pending

	for n in arr:
		if is_instance_valid(n):
			_fade_out_and_free(n)
	loaded_chunks.erase(key)

# ---------- Reveal management ----------
func _reveal_offscreen_spawns() -> void:
	if _pending_reveal.is_empty():
		return
	var screen_rect := _screen_world_rect(preload_margin_px)
	var cam := get_viewport().get_camera_2d()
	var cam_pos := cam.global_position if cam else Vector2.ZERO

	var keep: Array = []
	for e in _pending_reveal:
		var n: Node = e.get("node")
		if not is_instance_valid(n):
			continue

		var anchor: Vector2 = e.get("anchor_cam")
		var moved_far := cam_pos.distance_to(anchor) >= reveal_move_threshold_px

		if (not screen_rect.has_point(n.global_position)) or moved_far:
			n.visible = true
			n.modulate.a = 0.0
			_set_collision_enabled(n, true, true)
			_fade_in(n)
		else:
			keep.append(e)
	_pending_reveal = keep

# ---------- Blue-noise helpers ----------
func _is_local_max(ix: int, iy: int, r: int) -> bool:
	var my := _score(ix, iy)
	for dy in range(-r, r + 1):
		for dx in range(-r, r + 1):
			if dx == 0 and dy == 0:
				continue
			if _score(ix + dx, iy + dy) > my:
				return false
	return true

func _score(ix: int, iy: int) -> int:
	return _hash(ix, iy)

# ---------- Fades ----------
func _fade_in(n: Node) -> void:
	if not is_instance_valid(n): return
	var t := create_tween()
	t.tween_property(n, "modulate:a", 1.0, fade_duration).from(0.0)

func _fade_out_and_free(n: Node) -> void:
	if not is_instance_valid(n): return
	var t := create_tween()
	t.tween_property(n, "modulate:a", 0.0, fade_duration)
	t.tween_callback(Callable(n, "queue_free"))

# ---------- Collision toggle ----------
func _set_collision_enabled(n: Node, enabled: bool, deep: bool = false) -> void:
	if n is CollisionShape2D:
		(n as CollisionShape2D).disabled = (not enabled)
	elif n is CollisionPolygon2D:
		(n as CollisionPolygon2D).disabled = (not enabled)
	elif n is Area2D:
		(n as Area2D).monitoring = enabled
		(n as Area2D).monitorable = enabled
	elif n is PhysicsBody2D:
		# optional: adjust layers/masks if you want hard disable
		pass
	if deep:
		for child in n.get_children():
			_set_collision_enabled(child, enabled, true)

# ---------- Observer / camera ----------
func _observer_position() -> Vector2:
	var p := get_node_or_null(NodePath("%Player"))
	if p and p is Node2D:
		return (p as Node2D).global_position
	var cam := get_viewport().get_camera_2d()
	return cam.global_position if cam else Vector2.ZERO

func _screen_world_rect(margin_px: float) -> Rect2:
	var cam := get_viewport().get_camera_2d()
	if not cam:
		return Rect2(Vector2.ZERO, Vector2.ZERO)
	var vp := get_viewport_rect().size
	var half := (vp * cam.zoom * 0.5) + Vector2(margin_px, margin_px)
	var center := cam.global_position
	return Rect2(center - half, half * 2.0)

# ---------- Utility ----------
func _world_to_chunk(p: Vector2) -> Vector2i:
	return Vector2i(int(floor(p.x / chunk_size)), int(floor(p.y / chunk_size)))

func _key(c: Vector2i) -> String:
	return str(c.x, ",", c.y)

func _in_rect(pt: Vector2, a: Vector2, b: Vector2) -> bool:
	return pt.x >= a.x and pt.x < b.x and pt.y >= a.y and pt.y < b.y

func _hash(ix: int, iy: int) -> int:
	var h: int = int((ix * 73856093) ^ (iy * 19349663))
	if h < 0: h = -h
	return h

func _get_or_make_interactables() -> Node:
	var n := get_node_or_null(NodePath("%Interactables"))
	if n: return n
	n = get_node_or_null("Interactables")
	if n: return n
	var ys := Node2D.new()
	ys.name = "Interactables"
	add_child(ys)
	return ys
