extends Node2D

@export var sprite_path: NodePath          # set this to your Sprite2D in the Inspector
@export var player_path: NodePath
@export var camera_path: NodePath
@export var pixels_per_world_unit: float = 1.0
@export var world_aligned: bool = true  # Set to true for static background aligned with world objects
@export var parallax_factor: float = 0.85  # Only used when world_aligned is false

@onready var lunar_sprite: Sprite2D = _resolve_sprite()
@onready var player: Node2D = get_node_or_null(player_path) as Node2D
var local_player: Node2D = null  # Cache for the local player
var last_valid_player_pos: Vector2 = Vector2.ZERO  # Cache last known good player position
@onready var cam: Camera2D = (
	get_node_or_null(camera_path) as Camera2D
	if camera_path != NodePath() else get_viewport().get_camera_2d()
)

func _ready() -> void:
	if lunar_sprite == null:
		push_error("BackgroundLunar: Sprite2D not found. Set 'sprite_path' in Inspector or name a child 'Lunar'.")
		return

	lunar_sprite.centered = false
	if lunar_sprite.material == null:
		lunar_sprite.material = ShaderMaterial.new()

	_ensure_texture()
	_fit_to_viewport()

	if get_viewport():
		get_viewport().size_changed.connect(_fit_to_viewport)

	z_index = -1000
	lunar_sprite.z_index = -1000

func _process(_dt: float) -> void:
	if lunar_sprite == null or lunar_sprite.material == null:
		return

	var mat := lunar_sprite.material as ShaderMaterial
	var vp := get_viewport_rect().size

	# read virtual pixel resolution from the shader (or hardcode to match your shader)
	var pix_res : Variant = mat.get_shader_parameter("u_pixel_res")
	if typeof(pix_res) != TYPE_VECTOR2 or pix_res == Vector2.ZERO:
		pix_res = Vector2(320, 180)  # fallback if not set

	# size of ONE virtual pixel in screen units
	var px := Vector2(vp.x / pix_res.x, vp.y / pix_res.y)

	# Find local player if not cached or if the cached one is invalid
	_update_local_player_reference()

	# Update background scale for current camera zoom
	_fit_to_viewport()

	# Get camera position for sprite positioning (keep this simple)
	var cam_pos := Vector2.ZERO
	if cam != null:
		cam_pos = cam.global_position

	# Account for zoom when calculating viewport coverage
	var effective_vp := vp
	if cam != null and cam.zoom.x > 0:
		effective_vp = vp / cam.zoom.x  # Larger effective viewport when zoomed out

	# snap the sprite's top-left to the virtual pixel grid (prevents swimming)
	var top_left := cam_pos - effective_vp * 0.5
	var snapped_tl := Vector2(
		floor(top_left.x / px.x) * px.x,
		floor(top_left.y / px.y) * px.y
	)
	lunar_sprite.position = snapped_tl

	# Calculate world offset - account for zoom to prevent fast movement when zoomed out
	var world_offset: Vector2
	var zoom_compensation := 1.0
	if cam != null and cam.zoom.x > 0:
		zoom_compensation = cam.zoom.x  # Use zoom to normalize movement speed
	
	if world_aligned:
		# Static background aligned with world objects
		# Since camera now follows player directly, use camera position
		world_offset = cam_pos * pixels_per_world_unit * zoom_compensation
	else:
		# Parallax background
		var player_pos = _get_best_player_position()
		var using_player = player_pos != Vector2.ZERO
		var src: Vector2 = (player_pos if using_player else cam_pos)
		world_offset = src * pixels_per_world_unit * parallax_factor * zoom_compensation
		

	# snap offset to the same grid so shader sampling is stable
	var snapped_off := Vector2(
		floor(world_offset.x / px.x) * px.x,
		floor(world_offset.y / px.y) * px.y
	)
	

	mat.set_shader_parameter("u_time", Time.get_ticks_msec() / 1000.0)
	mat.set_shader_parameter("u_offset", snapped_off)
	mat.set_shader_parameter("u_view_size", vp)

func _fit_to_viewport() -> void:
	if lunar_sprite == null:
		return
	_ensure_texture()
	var vp := get_viewport_rect().size
	var tex := lunar_sprite.texture
	var tex_size := Vector2(max(1.0, tex.get_width()), max(1.0, tex.get_height()))
	
	# Account for camera zoom - when zoomed out, background needs to be bigger
	var zoom_factor := 1.0
	if cam != null and cam.zoom.x > 0:
		zoom_factor = 1.0 / cam.zoom.x  # Inverse of zoom (zoom out = bigger background)
	
	var base_scale := Vector2(vp.x / tex_size.x, vp.y / tex_size.y)
	lunar_sprite.scale = base_scale * zoom_factor

func _ensure_texture() -> void:
	if lunar_sprite == null:
		return
	if lunar_sprite.texture == null:
		var img := Image.create(1, 1, false, Image.FORMAT_RGBA8)
		img.set_pixel(0, 0, Color(1, 1, 1, 1))
		lunar_sprite.texture = ImageTexture.create_from_image(img)

func _resolve_sprite() -> Sprite2D:
	# A) Use Inspector path if set
	if sprite_path != NodePath():
		var n := get_node_or_null(sprite_path)
		if n is Sprite2D:
			return n

	# B) Look for a direct child named "Lunar"
	var by_name := get_node_or_null("Lunar")
	if by_name is Sprite2D:
		return by_name as Sprite2D

	# C) Recursive search for any Sprite2D
	return _find_sprite_recursive(self)

func _find_sprite_recursive(node: Node) -> Sprite2D:
	for c in node.get_children():
		if c is Sprite2D:
			return c as Sprite2D
		var r := _find_sprite_recursive(c)
		if r != null:
			return r
	return null

func _update_local_player_reference() -> void:
	# Try to use the explicit player reference first
	if player != null and is_instance_valid(player):
		local_player = player
		return
	
	# Search for the local player in the scene tree
	if local_player == null or not is_instance_valid(local_player):
		local_player = _find_local_player()

func _find_local_player() -> Node2D:
	# Look for the MainNetClient and get its local player
	var main_client = get_tree().get_first_node_in_group("main_client")
	if main_client == null:
		# Fallback: search for MainNetClient by name/type
		main_client = _find_main_net_client_recursive(get_tree().root)
	
	if main_client != null and main_client.has_method("get_local_player"):
		return main_client.get_local_player()
	
	# Fallback: look for any Player node with is_local_player = true
	return _find_local_player_recursive(get_tree().root)

func _find_main_net_client_recursive(node: Node) -> Node:
	if node.get_script() != null:
		var script_path = node.get_script().resource_path
		if script_path.ends_with("MainNetClient.gd"):
			return node
	
	for child in node.get_children():
		var result = _find_main_net_client_recursive(child)
		if result != null:
			return result
	return null

func _find_local_player_recursive(node: Node) -> Node2D:
	# Check if this node is a local player
	if node is Node2D:
		# Try different ways to check if it's a local player
		if node.has_method("get") and node.get("is_local_player") == true:
			return node as Node2D
		if "is_local_player" in node and node.is_local_player == true:
			return node as Node2D
		# Check if it has a script with is_local_player property
		if node.get_script() != null and "is_local_player" in node and node.is_local_player:
			return node as Node2D
	
	for child in node.get_children():
		var result = _find_local_player_recursive(child)
		if result != null:
			return result
	return null

func _get_best_player_position() -> Vector2:
	if local_player != null and is_instance_valid(local_player):
		var pos = local_player.global_position
		# Cache this valid position
		last_valid_player_pos = pos
		return pos
	else:
		# Return last valid position instead of Vector2.ZERO to avoid fallback to camera
		return last_valid_player_pos
