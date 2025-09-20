extends Node2D

@export var sprite_path: NodePath          # set this to your Sprite2D in the Inspector
@export var player_path: NodePath
@export var camera_path: NodePath
@export var pixels_per_world_unit: float = 1.0
@export var parallax: float = 0.85

@onready var lunar_sprite: Sprite2D = _resolve_sprite()
@onready var player: Node2D = get_node_or_null(player_path) as Node2D
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

	# camera world pos
	var cam_pos := Vector2.ZERO
	if cam != null:
		cam_pos = cam.global_position

	# snap the sprite's top-left to the virtual pixel grid (prevents swimming)
	var top_left := cam_pos - vp * 0.5
	var snapped_tl := Vector2(
		floor(top_left.x / px.x) * px.x,
		floor(top_left.y / px.y) * px.y
	)
	lunar_sprite.position = snapped_tl

	# choose movement source (player if present, else camera)
	var src := (player.global_position if player != null else cam_pos)
	var world_offset := src * pixels_per_world_unit * parallax

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
	lunar_sprite.scale = Vector2(vp.x / tex_size.x, vp.y / tex_size.y)

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
