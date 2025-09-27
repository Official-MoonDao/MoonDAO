extends Node2D

@export var texture_path: String = "res://art/lunar.png"  # Path to lunar texture
@export var tile_size: int = 2048  # Size of each background tile
@export var visible_range: int = 3  # How many tiles to keep loaded around camera

var background_sprites: Dictionary = {}  # Track active tiles
var cam: Camera2D
var last_camera_tile: Vector2i = Vector2i.ZERO

func _ready() -> void:
	# Find the camera
	cam = get_viewport().get_camera_2d()
	if not cam:
		push_error("BackgroundLunar: No camera found!")
		return

	# Set background to render behind everything
	z_index = -1000
	
	# Initialize the first set of background tiles
	_update_background_tiles(Vector2i.ZERO)
	
	print("BackgroundLunar: Infinite tiling background ready")

func _process(_dt: float) -> void:
	if not cam:
		return
	
	# Calculate which tile the camera is currently over
	var camera_pos = cam.global_position
	var current_tile = Vector2i(
		int(floor(camera_pos.x / tile_size)),
		int(floor(camera_pos.y / tile_size))
	)
	
	# Only update tiles if camera moved to a different tile
	if current_tile != last_camera_tile:
		_update_background_tiles(current_tile)
		last_camera_tile = current_tile

func _update_background_tiles(center_tile: Vector2i) -> void:
	"""Update background tiles around the camera position"""
	var new_tiles: Dictionary = {}
	
	# Calculate which tiles should be visible
	for x in range(-visible_range, visible_range + 1):
		for y in range(-visible_range, visible_range + 1):
			var tile_coord = center_tile + Vector2i(x, y)
			var tile_key = str(tile_coord.x) + "," + str(tile_coord.y)
			new_tiles[tile_key] = tile_coord
	
	# Remove tiles that are no longer needed
	for tile_key in background_sprites.keys():
		if not new_tiles.has(tile_key):
			var sprite = background_sprites[tile_key]
			sprite.queue_free()
			background_sprites.erase(tile_key)
	
	# Add new tiles that are now needed
	for tile_key in new_tiles.keys():
		if not background_sprites.has(tile_key):
			var tile_coord = new_tiles[tile_key]
			_create_background_tile(tile_coord, tile_key)

func _create_background_tile(tile_coord: Vector2i, tile_key: String) -> void:
	"""Create a single background tile at the specified coordinate"""
	# Load the texture
	var texture = load(texture_path) as Texture2D
	if not texture:
		push_error("BackgroundLunar: Could not load texture: " + texture_path)
		return
	
	# Create the background sprite for this tile
	var sprite = Sprite2D.new()
	sprite.texture = texture
	sprite.z_index = -1000
	
	# Position the tile
	sprite.global_position = Vector2(
		tile_coord.x * tile_size + tile_size / 2,
		tile_coord.y * tile_size + tile_size / 2
	)
	
	# Scale the sprite to fit the tile size
	var texture_size = texture.get_size()
	sprite.scale = Vector2(
		float(tile_size) / texture_size.x,
		float(tile_size) / texture_size.y
	)
	
	# Use linear filtering for smoother look
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	
	# Add the infinite tiling shader
	var shader_material = ShaderMaterial.new()
	var tiling_shader = _create_infinite_tiling_shader()
	shader_material.shader = tiling_shader
	
	# Pass the tile coordinate to the shader for seamless tiling
	shader_material.set_shader_parameter("tile_offset", Vector2(tile_coord))
	
	sprite.material = shader_material
	
	add_child(sprite)
	background_sprites[tile_key] = sprite

func _create_infinite_tiling_shader() -> Shader:
	"""Create a seamless shader without tiling boundaries"""
	var shader = Shader.new()
	shader.code = """
	shader_type canvas_item;
	
	uniform vec2 tile_offset;
	
	// Hash function for pseudo-random values
	float hash(vec2 p) {
		return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
	}
	
	// Smooth noise
	float noise(vec2 p) {
		vec2 i = floor(p);
		vec2 f = fract(p);
		f = f * f * (3.0 - 2.0 * f);
		
		float a = hash(i);
		float b = hash(i + vec2(1.0, 0.0));
		float c = hash(i + vec2(0.0, 1.0));
		float d = hash(i + vec2(1.0, 1.0));
		
		return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
	}
	
	void fragment() {
		// Calculate world position for this tile
		vec2 world_pos = tile_offset * 2048.0 + (UV - 0.5) * 2048.0;
		vec2 tile_coord = world_pos * 0.00025;
		
		// Apply subtle pixelation (same as original)
		float pixel_size = 200.0;  // Less pixelated but still retro
		vec2 pixelated_coord = floor(tile_coord * pixel_size) / pixel_size;
		
		// Get tile UV coordinates
		vec2 tile_uv = fract(pixelated_coord);
		
		// Create seamless wrapping by averaging edge samples (original logic)
		float edge_size = 0.08;  // 8% of texture for smoother edge blending
		vec3 color = texture(TEXTURE, tile_uv).rgb;
		
		// Blend with wrapped edges to eliminate seams
		if (tile_uv.x < edge_size) {
			// Near left edge - blend with right edge
			float wrap_x = tile_uv.x + 1.0 - edge_size;
			vec3 wrap_color = texture(TEXTURE, vec2(wrap_x, tile_uv.y)).rgb;
			float blend_weight = (edge_size - tile_uv.x) / edge_size;
			color = mix(color, wrap_color, blend_weight * 0.5);
		} else if (tile_uv.x > 1.0 - edge_size) {
			// Near right edge - blend with left edge  
			float wrap_x = tile_uv.x - 1.0 + edge_size;
			vec3 wrap_color = texture(TEXTURE, vec2(wrap_x, tile_uv.y)).rgb;
			float blend_weight = (tile_uv.x - (1.0 - edge_size)) / edge_size;
			color = mix(color, wrap_color, blend_weight * 0.5);
		}
		
		if (tile_uv.y < edge_size) {
			// Near top edge - blend with bottom edge
			float wrap_y = tile_uv.y + 1.0 - edge_size;
			vec3 wrap_color = texture(TEXTURE, vec2(tile_uv.x, wrap_y)).rgb;
			float blend_weight = (edge_size - tile_uv.y) / edge_size;
			color = mix(color, wrap_color, blend_weight * 0.5);
		} else if (tile_uv.y > 1.0 - edge_size) {
			// Near bottom edge - blend with top edge
			float wrap_y = tile_uv.y - 1.0 + edge_size;  
			vec3 wrap_color = texture(TEXTURE, vec2(tile_uv.x, wrap_y)).rgb;
			float blend_weight = (tile_uv.y - (1.0 - edge_size)) / edge_size;
			color = mix(color, wrap_color, blend_weight * 0.5);
		}
		
		// Add noise to break up any remaining patterns (original)
		float noise_val = noise(world_pos * 0.001) * 0.03;
		color += vec3(noise_val);
		
		COLOR = vec4(color, 1.0);
	}
	"""
	return shader
