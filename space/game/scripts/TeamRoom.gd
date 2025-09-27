# TeamRoom.gd - Visual representation of a team room with walls and floor
extends Node2D

@export var team_id: String = ""
@export var team_name: String = ""
@export var team_image: String = ""
@export var room_width: float = 1500.0
@export var room_height: float = 1500.0
@export var wall_thickness: float = 20.0

var team_label: Label
var floor_area: ColorRect
var walls: Array[StaticBody2D] = []
var access_indicator: Control
var room_center: Vector2
var is_initialized: bool = false
var wall_collision_shapes: Array[CollisionShape2D] = []
var access_barrier: StaticBody2D = null  # Invisible barrier when no access
var current_access_state: bool = false  # Track current access state to prevent redundant updates
var access_indicator_color: Color = Color(1.0, 0.0, 0.0, 0.3)  # Current color for the access indicator (red with 30% transparency)

# Team room colors (can be expanded)
var team_colors = [
	Color(0.2, 0.4, 0.8, 0.3),  # Blue
	Color(0.8, 0.2, 0.4, 0.3),  # Red  
	Color(0.2, 0.8, 0.4, 0.3),  # Green
	Color(0.8, 0.6, 0.2, 0.3),  # Orange
	Color(0.6, 0.2, 0.8, 0.3),  # Purple
	Color(0.8, 0.8, 0.2, 0.3),  # Yellow
	Color(0.2, 0.8, 0.8, 0.3),  # Cyan
	Color(0.8, 0.4, 0.6, 0.3),  # Pink
]

func _ready():
	# Don't create visuals immediately - wait for setup_team_room() to be called
	pass

func setup_team_room(teamId: String, teamName: String, teamImage: String, centerX: float, centerY: float, width: float, height: float):
	team_id = teamId
	team_name = teamName
	team_image = teamImage
	
	# Always update size and position from server data
	var size_changed = (room_width != width) or (room_height != height)
	var old_width = room_width
	var old_height = room_height
	room_width = width
	room_height = height
	room_center = Vector2(centerX, centerY)
	global_position = room_center - Vector2(room_width / 2, room_height / 2)
	
	print("TeamRoom.setup_team_room: Team ", teamId, " - Size changed from ", old_width, "x", old_height, " to ", width, "x", height)
	
	# Only recreate visuals if not initialized or size changed
	if not is_initialized or size_changed:
		_create_room_visuals()
		is_initialized = true
		print("Created team room visual for team ", teamId, " at ", global_position, " size: ", width, "x", height)
		print("TeamRoom floor_area final size: ", floor_area.size if floor_area else "no floor_area")

func _create_room_visuals():
	# Clear existing visuals
	for child in get_children():
		child.queue_free()
	walls.clear()
	wall_collision_shapes.clear()
	
	# Set team room to render behind players
	z_index = -50  # Behind players (0) but above background (-1000)
	
	# Create floor
	floor_area = ColorRect.new()
	floor_area.size = Vector2(room_width, room_height)
	floor_area.position = Vector2.ZERO
	
	# Use a team-specific color based on team ID hash
	var color_index = team_id.hash() % team_colors.size()
	if color_index < 0:
		color_index = -color_index
	floor_area.color = team_colors[color_index]
	
	add_child(floor_area)
	
	# Create walls with collision (4 StaticBody2D for each side)
	_create_wall(Vector2(0, -wall_thickness), Vector2(room_width, wall_thickness), "top")
	_create_wall(Vector2(0, room_height), Vector2(room_width, wall_thickness), "bottom")
	_create_wall(Vector2(-wall_thickness, 0), Vector2(wall_thickness, room_height), "left")
	_create_wall(Vector2(room_width, 0), Vector2(wall_thickness, room_height), "right")
	
	# Create team label (much larger for bigger rooms)
	team_label = Label.new()
	team_label.text = team_name if team_name != "" else ("Team " + team_id)
	team_label.position = Vector2(50, 50)
	team_label.add_theme_font_size_override("font_size", 64)  # Bigger font for bigger rooms
	team_label.add_theme_color_override("font_color", Color.WHITE)
	team_label.add_theme_color_override("font_shadow_color", Color.BLACK)
	team_label.add_theme_constant_override("shadow_offset_x", 4)
	team_label.add_theme_constant_override("shadow_offset_y", 4)
	add_child(team_label)
	
	# Create team image in center if available
	print("TeamRoom setup - team_image value: '", team_image, "'")
	if team_image != "" and team_image != "null":
		if not team_image.begins_with("ipfs://"):
			print("Warning: Team image URL is not IPFS format: ", team_image)
		else:
			print("Loading team image for team ", team_id, ": ", team_image)
			_load_team_image()
	else:
		print("No team image available for team ", team_id)
	
	# Create access indicator (round and transparent)
	access_indicator = Control.new()
	access_indicator.size = Vector2(80, 80)  # Bigger indicator
	access_indicator.position = Vector2(room_width - 130, 50)
	access_indicator.custom_minimum_size = Vector2(80, 80)
	access_indicator.draw.connect(_draw_access_indicator)
	add_child(access_indicator)

func _create_wall(pos: Vector2, size: Vector2, wall_name: String):
	"""Create a wall with collision detection"""
	var wall_body = StaticBody2D.new()
	wall_body.name = "Wall_" + wall_name
	wall_body.position = pos
	
	# Visual representation - thin, semi-transparent walls
	var wall_visual = ColorRect.new()
	wall_visual.size = size
	wall_visual.color = Color(1.0, 1.0, 1.0, 0.3)  # White with 30% opacity
	wall_visual.position = Vector2.ZERO  # Position relative to parent
	wall_body.add_child(wall_visual)
	
	# Collision shape - CRITICAL: Must be set up correctly
	var collision_shape = CollisionShape2D.new()
	var rect_shape = RectangleShape2D.new()
	rect_shape.size = size
	collision_shape.shape = rect_shape
	collision_shape.position = size / 2  # Center the collision shape within the wall
	wall_body.add_child(collision_shape)
	
	# Make sure collision is enabled
	wall_body.collision_layer = 1  # Default collision layer
	wall_body.collision_mask = 1   # Default collision mask
	
	walls.append(wall_body)
	wall_collision_shapes.append(collision_shape)
	add_child(wall_body)
	print("Created wall ", wall_name, " at ", pos, " size ", size)

func _create_access_barrier():
	"""Create an invisible barrier that prevents entry when access is denied"""
	if access_barrier:
		return  # Already exists
	
	access_barrier = StaticBody2D.new()
	access_barrier.name = "AccessBarrier"
	access_barrier.position = Vector2.ZERO
	
	# Create collision shape that covers the entire room interior
	var collision_shape = CollisionShape2D.new()
	var rect_shape = RectangleShape2D.new()
	rect_shape.size = Vector2(room_width - wall_thickness * 2, room_height - wall_thickness * 2)
	collision_shape.shape = rect_shape
	collision_shape.position = Vector2(room_width / 2, room_height / 2)
	access_barrier.add_child(collision_shape)
	
	# Make it slightly visible so players know they can't enter
	var barrier_visual = ColorRect.new()
	barrier_visual.size = rect_shape.size
	barrier_visual.position = Vector2(wall_thickness, wall_thickness)
	barrier_visual.color = Color(1.0, 0.0, 0.0, 0.2)  # Semi-transparent red
	access_barrier.add_child(barrier_visual)
	
	add_child(access_barrier)

func _remove_access_barrier():
	"""Remove the access barrier when access is granted"""
	if access_barrier and is_instance_valid(access_barrier):
		access_barrier.queue_free()
		access_barrier = null

func set_access_allowed(allowed: bool):
	"""Update visual indicator and collision for whether player can access this room"""
	# Only update if access state actually changed
	if current_access_state == allowed:
		return  # No change needed
	
	current_access_state = allowed
	print("🚪 Team ", team_id, " access CHANGED to: ", allowed)
	
	# Update access indicator color and transparency
	if access_indicator:
		if allowed:
			access_indicator_color = Color(0.0, 1.0, 0.0, 0.3)  # Green with 30% transparency
		else:
			access_indicator_color = Color(1.0, 0.0, 0.0, 0.3)  # Red with 30% transparency
		access_indicator.queue_redraw()
	
	# Enable/disable wall collisions based on access
	for wall in walls:
		if wall and is_instance_valid(wall):
			if allowed:
				# Disable collision for walls when player has access
				wall.collision_layer = 0  # Remove from collision layers
				wall.collision_mask = 0   # Don't collide with anything
			else:
				# Enable collision for walls when player doesn't have access
				wall.collision_layer = 1  # Default collision layer
				wall.collision_mask = 1   # Default collision mask
	
	print("🔧 Team ", team_id, " wall collisions ", "DISABLED" if allowed else "ENABLED")

func _draw_access_indicator():
	"""Draw a circular, transparent access indicator"""
	if access_indicator:
		var center = access_indicator.size / 2
		var radius = min(access_indicator.size.x, access_indicator.size.y) / 2
		
		# Draw the circle with current color and transparency (no border)
		access_indicator.draw_circle(center, radius, access_indicator_color)

func get_room_bounds() -> Rect2:
	"""Return the bounds of this team room for collision detection"""
	return Rect2(global_position, Vector2(room_width, room_height))

func is_position_inside(pos: Vector2) -> bool:
	"""Check if a position is inside this team room"""
	var bounds = get_room_bounds()
	return bounds.has_point(pos)

func get_team_id() -> String:
	return team_id

func _load_team_image():
	"""Load and display team image from IPFS"""
	print("_load_team_image called for team ", team_id, " with image: ", team_image)
	
	if team_image == "" or not team_image.begins_with("ipfs://"):
		print("Invalid team image URL: ", team_image)
		return
	
	# Convert IPFS URL to HTTP gateway URL
	var ipfs_hash = team_image.replace("ipfs://", "")
	var gateway_url = "https://gray-main-toad-36.mypinata.cloud/ipfs/" + ipfs_hash
	
	print("Converted IPFS URL: ", team_image, " -> ", gateway_url)
	
	# Create HTTPRequest node for downloading the image
	var http_request = HTTPRequest.new()
	http_request.name = "TeamImageRequest"
	add_child(http_request)
	
	# Connect the request completion signal
	http_request.request_completed.connect(_on_image_downloaded)
	
	# Start the download
	print("Starting image download for team ", team_id, ": ", gateway_url)
	var error = http_request.request(gateway_url)
	if error != OK:
		print("❌ Failed to start image download for team ", team_id, ": ", error)
		http_request.queue_free()
	else:
		print("✅ HTTP request started successfully for team ", team_id)

func _on_image_downloaded(result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray):
	"""Handle the downloaded team image"""
	print("🖼️ Image download completed for team ", team_id, ":")
	print("  - Result: ", result)
	print("  - Response code: ", response_code)
	print("  - Body size: ", body.size(), " bytes")
	
	if response_code == 200 and body.size() > 0:
		print("✅ Image data received, attempting to load...")
		
		# Create image texture from downloaded data
		var image = Image.new()
		var load_result = image.load_png_from_buffer(body)
		
		if load_result != OK:
			print("PNG load failed, trying JPG...")
			load_result = image.load_jpg_from_buffer(body)
		
		if load_result != OK:
			print("JPG load failed, trying WebP...")
			load_result = image.load_webp_from_buffer(body)
		
		if load_result == OK:
			print("✅ Image loaded successfully, creating texture...")
			
			# Create texture from image
			var texture = ImageTexture.new()
			texture.set_image(image)  # Updated for Godot 4
			
			# Create a container for the rounded image
			var image_container = Control.new()
			image_container.name = "TeamImageContainer_" + team_id
			
			# Position container in center of room
			var image_size = 450.0  # Larger size for better visibility
			image_container.size = Vector2(image_size, image_size)
			image_container.position = Vector2(
				(room_width - image_size) / 2,
				(room_height - image_size) / 2
			)
			
			# Create TextureRect to display the image
			var team_image_rect = TextureRect.new()
			team_image_rect.name = "TeamImage_" + team_id
			team_image_rect.texture = texture
			team_image_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
			team_image_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			team_image_rect.size = Vector2(image_size, image_size)
			team_image_rect.position = Vector2.ZERO
			
			# Create a circular mask with transparency using a shader
			var shader_material = ShaderMaterial.new()
			var shader = Shader.new()
			shader.code = """
shader_type canvas_item;

void fragment() {
	vec2 center = vec2(0.5, 0.5);
	float dist = distance(UV, center);
	float radius = 0.5;
	float alpha = 1.0 - smoothstep(radius - 0.01, radius, dist);
	COLOR = texture(TEXTURE, UV);
	COLOR.a *= alpha * 0.4;  // Apply 60% transparency (40% opacity)
}
"""
			shader_material.shader = shader
			team_image_rect.material = shader_material
			
			# Add image to container, container to room
			image_container.add_child(team_image_rect)
			
			print("📍 Positioning image container at: ", image_container.position, " with size: ", image_container.size)
			
			add_child(image_container)
			print("🎉 Successfully loaded and displayed rounded team image for team ", team_id)
		else:
			print("❌ Failed to load image data for team ", team_id, " - Error code: ", load_result)
			print("   Supported formats: PNG, JPG, WebP")
	else:
		print("❌ Failed to download team image for team ", team_id, ":")
		print("   - HTTP Response: ", response_code)
		print("   - Body size: ", body.size())
	
	# Clean up the HTTP request
	for child in get_children():
		if child is HTTPRequest and child.name == "TeamImageRequest":
			print("🧹 Cleaning up HTTP request for team ", team_id)
			child.queue_free()
			break
