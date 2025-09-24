extends Control

@export var minimap_size: Vector2 = Vector2(220, 220)
@export var world_scale: float = 0.02  # How much world space fits in the minimap
@export var update_interval: float = 0.2  # Update frequency in seconds (reduced for stability)
@export var edge_margin: float = 10.0  # Margin from edge for clamped indicators

# Visual settings
@export var background_color: Color = Color(0.1, 0.1, 0.15, 0.8)
@export var border_color: Color = Color(0.3, 0.3, 0.4, 1.0)
@export var terrain_color: Color = Color(0.2, 0.2, 0.25, 0.6)
@export var local_player_color: Color = Color(0.2, 0.8, 0.2, 1.0)
@export var remote_player_color: Color = Color(0.7, 0.3, 0.9, 1.0)  # Purple for other players
@export var edge_indicator_color: Color = Color(1.0, 0.8, 0.2, 1.0)

# Team room colors
@export var accessible_team_room_color: Color = Color(0.2, 0.8, 0.2, 0.8)  # Green for accessible
@export var inaccessible_team_room_color: Color = Color(0.8, 0.2, 0.2, 0.6)  # Red for inaccessible
@export var team_room_size: float = 12.0  # Bigger squares

# References
var main_net_client: Node = null
var local_player: Node2D = null
var players: Dictionary = {}  # sessionId -> player data
var team_room_manager: Node = null  # Reference to team room manager

# UI elements
var background_panel: Panel
var minimap_viewport: SubViewport
var minimap_canvas: Control

# Update timing
var last_update: float = 0.0

# Server-side position data
var server_positions: Dictionary = {}  # sessionId -> server position data
var room_connection: Object = null  # Reference to Colyseus room

func _ready() -> void:
	print("DEBUG: Minimap _ready() called")
	
	# Force set the remote player color to purple (override @export)
	remote_player_color = Color(0.7, 0.3, 0.9, 1.0)
	print("🎨 MINIMAP: Set remote_player_color to purple: ", remote_player_color)
	
	# Set up the minimap UI
	_setup_minimap_ui()
	
	# Find the main net client
	_find_main_net_client()
	
	# Position in bottom-left corner
	_position_minimap()
	
	print("DEBUG: Minimap setup complete")

func _setup_minimap_ui() -> void:
	# Set the control size
	custom_minimum_size = minimap_size
	size = minimap_size
	
	# Create background panel
	background_panel = Panel.new()
	background_panel.size = minimap_size
	background_panel.position = Vector2.ZERO
	add_child(background_panel)
	
	# Style the background panel
	var style_box = StyleBoxFlat.new()
	style_box.bg_color = background_color
	style_box.border_color = border_color
	style_box.border_width_left = 2
	style_box.border_width_right = 2
	style_box.border_width_top = 2
	style_box.border_width_bottom = 2
	style_box.corner_radius_top_left = 8
	style_box.corner_radius_top_right = 8
	style_box.corner_radius_bottom_left = 8
	style_box.corner_radius_bottom_right = 8
	background_panel.add_theme_stylebox_override("panel", style_box)
	
	# Create canvas for drawing indicators
	minimap_canvas = Control.new()
	minimap_canvas.size = minimap_size
	minimap_canvas.position = Vector2.ZERO
	minimap_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(minimap_canvas)
	
	# Connect draw signal
	minimap_canvas.draw.connect(_on_canvas_draw)

func _find_main_net_client() -> void:
	print("DEBUG: Looking for main_net_client...")
	# Find the MainNetClient in the scene tree
	main_net_client = get_tree().get_first_node_in_group("main_client")
	if main_net_client != null:
		print("DEBUG: Found main_net_client in group: ", main_net_client.name)
	else:
		print("DEBUG: Not found in group, searching manually...")
		main_net_client = _search_for_main_net_client(get_tree().root)
		if main_net_client:
			print("DEBUG: Found main_net_client via search: ", main_net_client.name)
		else:
			print("DEBUG: Could not find main_net_client")

func _search_for_main_net_client(node: Node) -> Node:
	# Check if this node has the MainNetClient script
	if node.get_script() != null:
		var script_path = node.get_script().resource_path
		if script_path.ends_with("MainNetClient.gd"):
			return node
	
	# Search children
	for child in node.get_children():
		var result = _search_for_main_net_client(child)
		if result != null:
			return result
	
	return null

func _position_minimap() -> void:
	# Position in bottom-left corner with some margin
	var screen_size = get_viewport().get_visible_rect().size
	position = Vector2(20, screen_size.y - minimap_size.y - 20)
	
	# Connect to screen size changes (only if not already connected)
	if not get_viewport().size_changed.is_connected(_on_screen_size_changed):
		get_viewport().size_changed.connect(_on_screen_size_changed)

func _on_screen_size_changed() -> void:
	_position_minimap()

func _process(_delta: float) -> void:
	if not main_net_client:
		_find_main_net_client()
		return
	
	var current_time = Time.get_ticks_msec() / 1000.0
	
	if current_time - last_update >= update_interval:
		_update_player_data()
		minimap_canvas.queue_redraw()
		last_update = current_time

func _update_player_data() -> void:
	if not main_net_client:
		return
	
	# Get local player
	if main_net_client.has_method("get_local_player"):
		local_player = main_net_client.get_local_player()
	
	# Get team room manager
	if not team_room_manager and "team_room_manager" in main_net_client:
		team_room_manager = main_net_client.team_room_manager
	
	# Get all players - try different access methods
	var new_players = {}
	if "players" in main_net_client:
		new_players = main_net_client.players
	elif main_net_client.has_method("get_players"):
		new_players = main_net_client.get_players()
	else:
		var direct_players = main_net_client.get("players")
		if direct_players != null:
			new_players = direct_players
	
	players = new_players

func _request_server_positions() -> void:
	"""Request authoritative positions from server"""
	if not room_connection:
		# Try to get room connection from main_net_client
		if main_net_client and main_net_client.has_method("get_room"):
			room_connection = main_net_client.get_room()
		elif main_net_client and "room" in main_net_client:
			room_connection = main_net_client.room
		
		print("DEBUG: Room connection attempt - ", room_connection != null)
	
	if room_connection and room_connection.has_method("send"):
		# Set up response listener if not already done
		if room_connection.has_method("onMessage"):
			room_connection.onMessage("minimap_positions_response", _on_server_positions_received)
			print("DEBUG: Set up minimap_positions_response listener")
		
		# Request positions from server
		room_connection.send("minimap_positions", {})
		print("DEBUG: Sent minimap_positions request to server")
	else:
		print("DEBUG: Falling back to local player data - room_connection: ", room_connection != null)
		# Fallback to local player data if server query fails
		_update_player_data()

func _on_server_positions_received(data: Dictionary) -> void:
	"""Handle server position response"""
	print("DEBUG: Received server positions response: ", data)
	if "positions" in data:
		server_positions = data.positions
		print("DEBUG: Updated server_positions with ", server_positions.size(), " players")
		
		# Always update local player reference
		_update_local_player_reference()

func _update_local_player_reference() -> void:
	"""Update local player reference for relative positioning"""
	if main_net_client and main_net_client.has_method("get_local_player"):
		local_player = main_net_client.get_local_player()
		print("DEBUG: Updated local_player reference: ", local_player != null)
		if local_player and "session_id" in local_player:
			print("DEBUG: Local player session_id: ", local_player.session_id)
	else:
		print("DEBUG: Could not get local player from main_net_client")

func _draw_minimap() -> void:
	if not local_player:
		return
	
	var local_pos = local_player.global_position
	var minimap_center = minimap_size * 0.5
	var minimap_radius = min(minimap_size.x, minimap_size.y) * 0.5 - edge_margin
	
	# Draw player indicators
	for session_id in players.keys():
		var player_node = players[session_id]
		if not is_instance_valid(player_node):
			continue
		
		var player_pos = player_node.global_position
		var is_local = (player_node == local_player)
		
		# Calculate relative position to local player
		var relative_pos = (player_pos - local_pos) * world_scale
		var minimap_pos = minimap_center + relative_pos
		
		# Check if player is within minimap bounds
		var distance_from_center = relative_pos.length()
		var max_distance = minimap_radius
		
		var indicator_color = local_player_color if is_local else remote_player_color
		var indicator_size = 6.0 if is_local else 5.0
		
		if distance_from_center <= max_distance:
			# Player is within minimap bounds - draw normally
			_draw_player_indicator(minimap_pos, indicator_color, indicator_size, is_local)
		else:
			# Player is outside bounds - draw on edge with direction
			var direction = relative_pos.normalized()
			var edge_pos = minimap_center + direction * max_distance
			_draw_edge_indicator(edge_pos, direction, indicator_color, is_local)

func _draw_player_indicator(pos: Vector2, color: Color, indicator_size: float, is_local: bool) -> void:
	# Draw player dot
	minimap_canvas.draw_circle(pos, indicator_size, color)
	
	# Draw border for better visibility
	var indicator_border_color = Color.WHITE if is_local else Color.BLACK
	minimap_canvas.draw_arc(pos, indicator_size + 1, 0, TAU, 16, indicator_border_color, 1.0)

func _draw_edge_indicator(pos: Vector2, direction: Vector2, color: Color, is_local: bool) -> void:
	var edge_size = 6.0 if is_local else 5.0
	
	# Draw the indicator dot
	minimap_canvas.draw_circle(pos, edge_size, color)
	
	# Draw direction arrow
	var arrow_length = 8.0
	var arrow_end = pos + direction * arrow_length
	var arrow_width = 3.0
	
	# Calculate arrow points
	var perp = Vector2(-direction.y, direction.x) * arrow_width
	var arrow_points = PackedVector2Array([
		arrow_end,
		pos + perp,
		pos - perp
	])
	
	minimap_canvas.draw_colored_polygon(arrow_points, color)
	
	# Draw border
	minimap_canvas.draw_arc(pos, edge_size + 1, 0, TAU, 16, Color.WHITE, 1.0)

func _on_canvas_draw() -> void:
	if not local_player:
		# Draw a debug indicator to show the minimap is working
		var center = minimap_size * 0.5
		minimap_canvas.draw_circle(center, 5, Color.RED)
		minimap_canvas.draw_string(get_theme_default_font(), center + Vector2(10, 0), "No Local Player", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.WHITE)
		return
	
	var local_pos = local_player.global_position
	var minimap_center = minimap_size * 0.5
	var minimap_radius = min(minimap_size.x, minimap_size.y) * 0.5 - edge_margin
	
	# Draw terrain pattern
	_draw_terrain_pattern(local_pos, minimap_center, minimap_radius)
	
	# Draw team rooms
	_draw_team_rooms(local_pos, minimap_center, minimap_radius)
	
	# Draw player indicators - AGGRESSIVE network position usage
	for session_id in players.keys():
		var player_node = players[session_id]
		if not is_instance_valid(player_node):
			continue
		
		var is_local = (player_node == local_player)
		
		# SIMPLE: Just use global_position - exactly what the visual map uses
		var display_pos = player_node.global_position
		
		# Calculate relative position to local player
		var relative_pos = (display_pos - local_pos) * world_scale
		var minimap_pos = minimap_center + relative_pos
		
		# Check if player is within minimap bounds
		var distance_from_center = relative_pos.length()
		var max_distance = minimap_radius
		
		var indicator_color = local_player_color if is_local else remote_player_color
		var indicator_size = 6.0 if is_local else 5.0
		
		if distance_from_center <= max_distance:
			# Player is within minimap bounds - draw normally
			_draw_player_indicator(minimap_pos, indicator_color, indicator_size, is_local)
		else:
			# Player is outside bounds - draw on edge with direction
			var direction = relative_pos.normalized()
			var edge_pos = minimap_center + direction * max_distance
			_draw_edge_indicator(edge_pos, direction, indicator_color, is_local)
	
	# Clean minimap - no debug text

func _draw_terrain_pattern(local_pos: Vector2, center: Vector2, radius: float) -> void:
	# Draw some simple terrain indicators (craters, etc.)
	# This gives a sense of the world geography
	var pattern_scale = 0.005  # Scale for terrain pattern
	
	# Draw several terrain features based on world position
	for i in range(8):
		var angle = (i / 8.0) * TAU
		var feature_world_pos = local_pos + Vector2(cos(angle), sin(angle)) * (radius / world_scale * 0.3)
		
		# Create a simple hash-based pattern for consistent terrain
		var hash_x = int(feature_world_pos.x * pattern_scale) 
		var hash_y = int(feature_world_pos.y * pattern_scale)
		var terrain_hash = (hash_x * 73 + hash_y * 37) % 100
		
		if terrain_hash < 30:  # 30% chance of terrain feature
			var feature_screen_pos = center + Vector2(cos(angle), sin(angle)) * radius * 0.3
			var feature_size = 2.0 + (terrain_hash % 3)
			minimap_canvas.draw_circle(feature_screen_pos, feature_size, terrain_color)

func _draw_team_rooms(local_pos: Vector2, center: Vector2, radius: float) -> void:
	"""Draw team room indicators on the minimap"""
	if not team_room_manager:
		return
	
	# Get team rooms from the team room manager
	var team_rooms = {}
	if team_room_manager.has_method("get_team_rooms"):
		team_rooms = team_room_manager.get_team_rooms()
	
	if team_rooms.size() == 0:
		return
	
	# Get local player's teams for access checking
	var local_player_teams = []
	if "local_player_team_ids" in team_room_manager:
		local_player_teams = team_room_manager.local_player_team_ids
	
	# Draw each team room
	for team_id in team_rooms.keys():
		var team_room = team_rooms[team_id]
		if not is_instance_valid(team_room):
			continue
		
		# Get team room world position
		var team_room_pos = team_room.global_position + Vector2(team_room.room_width / 2, team_room.room_height / 2)  # Center of room
		
		# Calculate relative position to local player
		var relative_pos = (team_room_pos - local_pos) * world_scale
		var minimap_pos = center + relative_pos
		
		# Check if team room is within minimap bounds
		var distance_from_center = relative_pos.length()
		var max_distance = radius
		
		if distance_from_center <= max_distance:
			# Determine if player has access to this team room
			var has_access = local_player_teams.has(team_id)
			var room_color = accessible_team_room_color if has_access else inaccessible_team_room_color
			
			# Draw team room as a square
			var room_rect = Rect2(minimap_pos - Vector2(team_room_size / 2, team_room_size / 2), Vector2(team_room_size, team_room_size))
			minimap_canvas.draw_rect(room_rect, room_color)
			
			# Draw border
			var border_color = Color.WHITE if has_access else Color.BLACK
			minimap_canvas.draw_rect(room_rect, border_color, false, 1.0)
			
			# Draw team ID text centered in the square
			var font = get_theme_default_font()
			var font_size = 10
			var text_size = font.get_string_size(team_id, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size)
			var text_pos = minimap_pos - Vector2(text_size.x / 2, -text_size.y / 2 - 2)  # Center text in square
			minimap_canvas.draw_string(font, text_pos, team_id, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, Color.WHITE)

# Smoothing function removed - using server positions directly
