# SpatialVoiceManager.gd - Manages spatial voice chat using LiveKit rooms
extends Node

# Grid configuration
const GRID_CELL_SIZE := 1500  # 1500x1500 pixel cells (adjust based on your world size)
const VOICE_PROXIMITY_RANGE := 800.0  # How far voice should reach within a cell

# Voice state
var current_voice_room := ""
var current_grid_cell := Vector2i(-999, -999)  # Invalid initial position
var is_in_team_room := false
var livekit_manager: Node = null
var main_client: Node = null

signal voice_room_changed(new_room: String)

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
	
	# Calculate grid cell
	var new_grid_cell = Vector2i(
		int(position.x / GRID_CELL_SIZE),
		int(position.y / GRID_CELL_SIZE)
	)
	
	# Debug logging with more detail
	if new_grid_cell != current_grid_cell:
		print("🌐 SpatialVoice: Moving from grid cell ", current_grid_cell, " to ", new_grid_cell, " at position ", position)
		var old_cell = current_grid_cell
		current_grid_cell = new_grid_cell
		var new_voice_room = "grid-%d-%d" % [new_grid_cell.x, new_grid_cell.y]
		var old_voice_room = current_voice_room
		print("🌐 SpatialVoice: Switching to voice room: ", new_voice_room, " (from: ", old_voice_room, ")")
		
		# Track if we're returning to a previously visited cell
		if old_cell != Vector2i(-999, -999):  # Not initial spawn
			print("🌐 SpatialVoice: This is a room transition from ", old_cell, " to ", new_grid_cell)
			if new_voice_room == old_voice_room:
				print("🌐 SpatialVoice: ⚠️ WARNING - Room name is the same but grid cell changed!")
		
		_change_voice_room(new_voice_room)
	else:
		# Even if we're in the same grid cell, periodically check connection status
		# This helps catch cases where the connection dropped but we didn't realize
		var frame_count = Engine.get_process_frames()
		if frame_count % 300 == 0:  # Check every ~5 seconds (60fps * 5)
			var expected_room = "grid-%d-%d" % [new_grid_cell.x, new_grid_cell.y]
			if current_voice_room != expected_room:
				print("SpatialVoice: Detected room mismatch! Expected: ", expected_room, " Current: ", current_voice_room)
				_change_voice_room(expected_room)

func on_team_room_entered(team_id: String):
	"""Handle entering a team room"""
	print("SpatialVoice: Entering team room ", team_id)
	is_in_team_room = true
	var team_voice_room = "team-" + team_id
	_change_voice_room(team_voice_room)

func on_team_room_exited(team_id: String):
	"""Handle exiting a team room - return to spatial grid"""
	print("SpatialVoice: Exiting team room ", team_id)
	is_in_team_room = false
	
	# Force recalculate grid position and switch to spatial voice
	if main_client and main_client.has_method("get_local_player"):
		var local_player = main_client.get_local_player()
		if local_player:
			# Force position update to switch back to grid room
			current_grid_cell = Vector2i(-999, -999)  # Reset so next update triggers change
			update_player_position(local_player.global_position)

func _change_voice_room(new_room: String):
	"""Change the current voice room"""
	print("SpatialVoice: _change_voice_room called - current: '", current_voice_room, "' new: '", new_room, "'")
	
	# ALWAYS force reconnection - this ensures we join existing rooms with other players
	# Even if the room name is the same, we need to reconnect to pick up other participants
	if new_room == current_voice_room:
		print("SpatialVoice: Same room name - forcing reconnection to join other players")
		print("SpatialVoice: 🔄 FORCING reconnection to room: ", new_room)
		
		# Force disconnection and reconnection by temporarily clearing room name
		var temp_room = current_voice_room
		current_voice_room = ""  # Clear to force reconnection
		
		# Wait a small moment then reconnect
		await get_tree().create_timer(0.1).timeout
		
		if livekit_manager and livekit_manager.has_method("switch_voice_room"):
			print("SpatialVoice: Reconnecting to room: ", temp_room)
			livekit_manager.switch_voice_room(temp_room)
		
		current_voice_room = temp_room  # Restore the room name
		voice_room_changed.emit(new_room)
		return
	
	print("SpatialVoice: Changing voice room from '", current_voice_room, "' to '", new_room, "'")
	var old_room = current_voice_room
	current_voice_room = new_room
	
	# Switch LiveKit room (async call)
	if livekit_manager and livekit_manager.has_method("switch_voice_room"):
		print("SpatialVoice: Calling LiveKit switch_voice_room...")
		livekit_manager.switch_voice_room(new_room)  # Simple room switching
		print("SpatialVoice: LiveKit switch_voice_room call initiated")
	else:
		print("SpatialVoice: ❌ LiveKit manager not available or missing switch_voice_room method")
		print("SpatialVoice: ❌ livekit_manager exists: ", livekit_manager != null)
		if livekit_manager:
			print("SpatialVoice: ❌ has switch_voice_room method: ", livekit_manager.has_method("switch_voice_room"))
	
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
	
	print("SpatialVoice: 🎧 Triggering auto-connect for listening-only mode")
	
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
		# Fallback: connect to default grid room (0,0) in listen-only mode
		print("SpatialVoice: 🎧 Using fallback: connecting to grid-0-0 (listen-only)")
		if livekit_manager and livekit_manager.has_method("switch_voice_room"):
			livekit_manager.switch_voice_room("grid-0-0")
			current_voice_room = "grid-0-0"
			voice_room_changed.emit("grid-0-0")
