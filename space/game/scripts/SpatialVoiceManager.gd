# SpatialVoiceManager.gd - Manages spatial voice chat using LiveKit rooms
extends Node

# Grid configuration
const GRID_CELL_SIZE := 1500  # 1500x1500 pixel cells (must match server-side)
const VOICE_PROXIMITY_RANGE := 800.0  # How far voice should reach within a cell
const GRID_HYSTERESIS := 100.0  # Pixels of hysteresis to prevent boundary oscillation

# Voice state
var current_voice_room := ""
var current_grid_cell := Vector2i(-999, -999)  # Invalid initial position
var is_in_team_room := false
var livekit_manager: Node = null
var main_client: Node = null
var pending_position_update := false  # Throttle position updates
var last_position_update_time := 0.0  # Track timing for debouncing

signal voice_room_changed(new_room: String)
signal proximity_voice_enabled(enabled: bool)

func _ready():
	name = "SpatialVoiceManager"

func set_livekit_manager(manager: Node):
	"""Set reference to LiveKitVoiceManager"""
	livekit_manager = manager
	print("SpatialVoice: ✅ LiveKit manager connected")
	# Auto-connect after everything is set up
	call_deferred("_auto_connect_for_listening")

func set_main_client(client: Node):
	"""Set reference to MainNetClient"""
	main_client = client

func update_player_position(position: Vector2):
	"""Update player position and check if voice room needs to change"""
	if is_in_team_room:
		return  # Don't change voice rooms when in team room
	
	# Throttle position updates to avoid spam
	if pending_position_update:
		return
	
	# Calculate grid cell with hysteresis for stability
	var new_grid_cell = _calculate_grid_cell_with_hysteresis(position)
	
	# Only process if grid cell actually changed
	if new_grid_cell != current_grid_cell:
		print("🌐 SpatialVoice: Moving from grid cell ", current_grid_cell, " to ", new_grid_cell, " at position ", position)
		var old_cell = current_grid_cell
		current_grid_cell = new_grid_cell
		var new_voice_room = "grid-%d-%d" % [new_grid_cell.x, new_grid_cell.y]
		
		print("🌐 SpatialVoice: Switching to voice room: ", new_voice_room)
		_change_voice_room(new_voice_room)
		
		# Set throttle to prevent rapid updates - increased from 500ms to 1000ms
		pending_position_update = true
		await get_tree().create_timer(1.0).timeout
		pending_position_update = false

func _calculate_grid_cell_with_hysteresis(position: Vector2) -> Vector2i:
	"""Calculate grid cell with hysteresis to prevent boundary oscillation"""
	var base_cell = Vector2i(
		int(position.x / GRID_CELL_SIZE),
		int(position.y / GRID_CELL_SIZE)
	)
	
	# If we don't have a current cell, use the base calculation
	if current_grid_cell == Vector2i(-999, -999):
		return base_cell
	
	# Check if we're near a boundary and apply hysteresis
	var cell_center_x = (current_grid_cell.x * GRID_CELL_SIZE) + (GRID_CELL_SIZE / 2)
	var cell_center_y = (current_grid_cell.y * GRID_CELL_SIZE) + (GRID_CELL_SIZE / 2)
	
	var distance_from_center = Vector2(
		abs(position.x - cell_center_x),
		abs(position.y - cell_center_y)
	)
	
	# Only change cells if we're significantly outside the current cell
	# This creates a "dead zone" around boundaries to prevent oscillation
	var half_cell = GRID_CELL_SIZE / 2
	var threshold = half_cell + GRID_HYSTERESIS
	
	if distance_from_center.x > threshold or distance_from_center.y > threshold:
		return base_cell
	else:
		return current_grid_cell  # Stay in current cell due to hysteresis

func on_team_room_entered(team_id: String):
	"""Handle entering a team room"""
	print("SpatialVoice: Entering team room ", team_id, " (was in team room: ", is_in_team_room, ")")
	is_in_team_room = true
	var team_voice_room = "team-" + team_id
	print("SpatialVoice: Switching to team voice room: ", team_voice_room)
	_change_voice_room(team_voice_room)

func on_team_room_exited(team_id: String):
	"""Handle exiting a team room - return to spatial grid"""
	print("SpatialVoice: Exiting team room ", team_id)
	is_in_team_room = false
	
	# Add a small delay before recalculating to avoid rapid switching
	await get_tree().create_timer(0.5).timeout
	
	# Force recalculate grid position and switch to spatial voice
	if main_client and main_client.has_method("get_local_player"):
		var local_player = main_client.get_local_player()
		if local_player:
			# Force position update to switch back to grid room
			current_grid_cell = Vector2i(-999, -999)  # Reset so next update triggers change
			update_player_position(local_player.global_position)

func _change_voice_room(new_room: String):
	"""Change the current voice room"""
	if new_room == current_voice_room:
		return  # No change needed
	
	print("SpatialVoice: Changing voice room from '", current_voice_room, "' to '", new_room, "'")
	var old_room = current_voice_room
	current_voice_room = new_room
	
	# Switch LiveKit room
	if livekit_manager and livekit_manager.has_method("switch_voice_room"):
		print("SpatialVoice: Switching to LiveKit room: ", new_room)
		livekit_manager.switch_voice_room(new_room)
		proximity_voice_enabled.emit(true)  # Signal that proximity voice is active
	else:
		print("SpatialVoice: ❌ LiveKit manager not available for room switching")
	
	voice_room_changed.emit(new_room)

func get_current_voice_room() -> String:
	return current_voice_room

func get_players_in_voice_range(player_position: Vector2, all_players: Dictionary) -> Array:
	"""Get list of players within voice range (for debugging/UI)"""
	var nearby_players = []
	
	for session_id in all_players.keys():
		var player = all_players[session_id]
		if not player or not "global_position" in player:
			continue
			
		var distance = player_position.distance_to(player.global_position)
		if distance <= VOICE_PROXIMITY_RANGE:
			nearby_players.append({
				"session_id": session_id,
				"player": player,
				"distance": distance
			})
	
	return nearby_players

func _auto_connect_for_listening():
	"""Automatically connect to listen-only mode when player spawns"""
	if not livekit_manager:
		print("SpatialVoice: ❌ No LiveKit manager available for auto-connect")
		return
	
	print("SpatialVoice: 🎧 Triggering auto-connect for proximity voice")
	
	# Wait a moment for the player to spawn and get positioned
	await get_tree().create_timer(2.0).timeout
	
	# Check if we have a main client to get the local player
	if main_client and main_client.has_method("get_local_player"):
		var local_player = main_client.get_local_player()
		if local_player:
			print("SpatialVoice: 🎧 Auto-connecting player at position: ", local_player.global_position)
			# Trigger initial position update to connect to appropriate grid room
			update_player_position(local_player.global_position)
		else:
			print("SpatialVoice: ⚠️ No local player found for auto-connect")
	else:
		print("SpatialVoice: ⚠️ No main client available for auto-connect")
		# Fallback: connect to default grid room (0,0)
		print("SpatialVoice: 🎧 Using fallback: connecting to grid-0-0")
		_change_voice_room("grid-0-0")

func get_debug_info() -> Dictionary:
	"""Get debug information about the spatial voice system"""
	return {
		"current_voice_room": current_voice_room,
		"current_grid_cell": current_grid_cell,
		"is_in_team_room": is_in_team_room,
		"grid_cell_size": GRID_CELL_SIZE,
		"voice_range": VOICE_PROXIMITY_RANGE,
		"grid_hysteresis": GRID_HYSTERESIS,
		"livekit_manager_connected": livekit_manager != null,
		"pending_position_update": pending_position_update
	}
