extends Node2D

@export var texture_path: String = "res://art/lunar.png"  # Path to lunar texture
@export var background_size: int = 32768  # Large background size

var background_sprite: Sprite2D
var cam: Camera2D

func _ready() -> void:
	# Find the camera
	cam = get_viewport().get_camera_2d()
	if not cam:
		push_error("BackgroundLunar: No camera found!")
		return

	# Set background to render behind everything
	z_index = -1000
	
	# Create simple large background with proper shader
	_create_background()
	
	print("BackgroundLunar: Shader background ready")

func _process(_dt: float) -> void:
	# Background stays stationary - it's the world surface
	pass

func _create_background() -> void:
	"""Create a large background with proper tiling shader"""
	# Load the texture
	print("BackgroundLunar: Loading texture from: " + texture_path)
	var texture = load(texture_path) as Texture2D
	if not texture:
		push_error("BackgroundLunar: Could not load texture: " + texture_path)
		return

	print("BackgroundLunar: Successfully loaded texture: " + str(texture.get_size()))
	
	# Create the background sprite
	background_sprite = Sprite2D.new()
	background_sprite.texture = texture
	background_sprite.z_index = -1000
	
	# Scale it large
	var texture_size = texture.get_size()
	background_sprite.scale = Vector2(background_size / texture_size.x, background_size / texture_size.y)
	
	# Use linear filtering for smoother look
	background_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	
	# Add simple tiling shader with light blending
	var shader_material = ShaderMaterial.new()
	var tiling_shader = _create_tiling_shader()
	shader_material.shader = tiling_shader
	background_sprite.material = shader_material
	
	add_child(background_sprite)

func _create_tiling_shader() -> Shader:
	"""Create a seamless shader without tiling boundaries"""
	var shader = Shader.new()
	shader.code = """
	shader_type canvas_item;
	
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
		// Convert to world coordinates
		vec2 world_pos = (UV - 0.5) * 32768.0;
		vec2 tile_coord = world_pos * 0.00025;
		
		// Apply subtle pixelation
		float pixel_size = 200.0;  // Less pixelated but still retro
		vec2 pixelated_coord = floor(tile_coord * pixel_size) / pixel_size;
		
		// Get tile UV coordinates
		vec2 tile_uv = fract(pixelated_coord);
		
		// Create seamless wrapping by averaging edge samples
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
		
		// Add noise to break up any remaining patterns
		float noise_val = noise(world_pos * 0.001) * 0.03;
		color += vec3(noise_val);
		
		COLOR = vec4(color, 1.0);
	}
	"""
	return shader
