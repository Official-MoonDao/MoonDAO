# TeamRoomManager.gd - Manages team room visuals and interactions
extends Node2D

var team_room_script: GDScript = preload("res://scripts/TeamRoom.gd")
var team_rooms: Dictionary = {}  # teamId -> TeamRoom node
var room_ref: Object = null  # Reference to Colyseus room
var local_player_team_ids: Array[String] = []

signal team_room_entered(team_id: String)
signal team_room_exited(team_id: String)

func _ready():
	name = "TeamRoomManager"

func set_room_reference(room: Object):
	"""Set the Colyseus room reference for sending messages"""
	room_ref = room
	
	# Set up team room message handlers
	if room_ref:
		room_ref.on_message("team_room_entered").on(Callable(self, "_on_team_room_entered"))
		room_ref.on_message("team_room_exited").on(Callable(self, "_on_team_room_exited"))
		room_ref.on_message("team_room_access_denied").on(Callable(self, "_on_team_room_access_denied"))
		room_ref.on_message("team_room_not_found").on(Callable(self, "_on_team_room_not_found"))
		room_ref.on_message("player_entered_team_room").on(Callable(self, "_on_player_entered_team_room"))
		room_ref.on_message("player_exited_team_room").on(Callable(self, "_on_player_exited_team_room"))

func update_team_rooms_from_state(state):
	"""Update team room visuals from server state"""
	if not state:
		return
	
	# Get team rooms from state
	var team_rooms_map
	if state.has_method("get"):
		team_rooms_map = state.get("teamRooms")
	else:
		team_rooms_map = state.teamRooms
	
	if not team_rooms_map:
		return
	
	# Remove team rooms that no longer exist
	var existing_team_ids = team_rooms.keys()
	for team_id in existing_team_ids:
		if not team_rooms_map.has(team_id):
			_remove_team_room(team_id)
	
	# Add or update team rooms
	for team_id in team_rooms_map.keys():
		var team_room_data = team_rooms_map.at(team_id)
		_create_or_update_team_room(team_id, team_room_data)

func update_local_player_teams(team_ids: Array):
	"""Update the local player's team IDs for access control"""
	# Convert to Array[String] to match the variable type
	local_player_team_ids.clear()
	for team_id in team_ids:
		local_player_team_ids.append(str(team_id))
	print("🔍 TeamRoomManager: Local player teams set to: ", local_player_team_ids)
	
	# Update access indicators for all team rooms (ONLY when teams are initially set)
	for team_id in team_rooms.keys():
		var team_room = team_rooms[team_id]
		var has_access = local_player_team_ids.has(team_id)
		team_room.set_access_allowed(has_access)

func _create_or_update_team_room(team_id: String, room_data):
	"""Create or update a team room visual"""
	var team_room = team_rooms.get(team_id)
	
	if not team_room:
		# Create new team room
		team_room = Node2D.new()
		team_room.set_script(team_room_script)
		team_room.name = "TeamRoom_" + team_id
		add_child(team_room)
		team_rooms[team_id] = team_room
		
		# Initial setup for new room
		var center_x = float(room_data.centerX) if "centerX" in room_data else 0.0
		var center_y = float(room_data.centerY) if "centerY" in room_data else 0.0
		var width = float(room_data.width) if "width" in room_data else 200.0
		var height = float(room_data.height) if "height" in room_data else 200.0
		var team_name = str(room_data.teamName) if "teamName" in room_data else ("Team " + team_id)
		var team_image = str(room_data.teamImage) if "teamImage" in room_data else ""
		
		print("TeamRoomManager: Setting up room '", team_name, "' (", team_id, ") with:")
		print("  - Size: ", width, "x", height, " at (", center_x, ", ", center_y, ")")
		print("  - Team Image: '", team_image, "'")
		print("  - Raw room_data keys: ", room_data.keys() if room_data.has_method("keys") else "N/A")
		team_room.setup_team_room(team_id, team_name, team_image, center_x, center_y, width, height)
		print("TeamRoomManager: Created team room ", team_id)
	else:
		# Room already exists, no need to update access (will be set when player teams are loaded)
		pass

func _remove_team_room(team_id: String):
	"""Remove a team room visual"""
	var team_room = team_rooms.get(team_id)
	if team_room and is_instance_valid(team_room):
		team_room.queue_free()
	team_rooms.erase(team_id)
	print("TeamRoomManager: Removed team room ", team_id)

var current_team_room: String = ""  # Track which team room player is currently in

func check_team_room_entry(player_position: Vector2):
	"""Check if player should enter any team room"""
	var inside_any_room = false
	var target_team_room = ""
	
	# Check if player is inside any team room
	for team_id in team_rooms.keys():
		var team_room = team_rooms[team_id]
		if team_room.is_position_inside(player_position):
			inside_any_room = true
			target_team_room = team_id
			break
	
	# Handle team room state changes
	if inside_any_room:
		# Player is inside a team room
		if target_team_room != current_team_room:
			# Player entered a different team room
			if current_team_room != "":
				# Exit current team room first
				request_team_room_exit()
			
			# Check if player has access to this team room
			if local_player_team_ids.has(target_team_room):
				request_team_room_entry(target_team_room)
			else:
				print("TeamRoomManager: Player denied access to team room ", target_team_room)
	else:
		# Player is not inside any team room
		if current_team_room != "":
			# Exit current team room
			request_team_room_exit()

func request_team_room_entry(team_id: String):
	"""Request entry to a team room"""
	if room_ref:
		print("TeamRoomManager: Requesting entry to team room ", team_id)
		room_ref.send("enter_team_room", {"teamId": team_id})

func request_team_room_exit():
	"""Request exit from current team room"""
	if room_ref:
		print("TeamRoomManager: Requesting exit from team room")
		room_ref.send("exit_team_room", {})

# Message handlers from server
func _on_team_room_entered(data):
	"""Handle successful team room entry"""
	var team_id = data.get("teamId", "")
	current_team_room = team_id
	print("TeamRoomManager: Successfully entered team room ", team_id)
	team_room_entered.emit(team_id)

func _on_team_room_exited(data):
	"""Handle team room exit"""
	var team_id = data.get("teamId", "")
	current_team_room = ""
	print("TeamRoomManager: Exited team room ", team_id)
	team_room_exited.emit(team_id)

func _on_team_room_access_denied(data):
	"""Handle access denied to team room"""
	var team_id = data.get("teamId", "")
	print("TeamRoomManager: Access denied to team room ", team_id)
	# Could show visual feedback here

func _on_team_room_not_found(data):
	"""Handle team room not found error"""
	var team_id = data.get("teamId", "")
	print("TeamRoomManager: Team room not found ", team_id)

func _on_player_entered_team_room(data):
	"""Handle notification that another player entered a team room"""
	var session_id = data.get("sessionId", "")
	var player_name = data.get("playerName", "")
	var team_id = data.get("teamId", "")
	print("TeamRoomManager: Player ", player_name, " (", session_id, ") entered team room ", team_id)

func _on_player_exited_team_room(data):
	"""Handle notification that another player exited a team room"""
	var session_id = data.get("sessionId", "")
	var player_name = data.get("playerName", "")
	var team_id = data.get("teamId", "")
	print("TeamRoomManager: Player ", player_name, " (", session_id, ") exited team room ", team_id)

func get_team_rooms() -> Dictionary:
	"""Return the dictionary of team rooms for external access"""
	return team_rooms

func _refresh_all_access_control():
	"""Refresh access control for all team rooms based on current local_player_team_ids"""
	print("🔄 Refreshing access control for all team rooms...")
	print("🔄 Current local_player_team_ids: ", local_player_team_ids)
	
	for team_id in team_rooms.keys():
		var team_room = team_rooms[team_id]
		var has_access = local_player_team_ids.has(team_id)
		print("🔄 Refreshing access for team ", team_id, ": has_access=", has_access)
		team_room.set_access_allowed(has_access)
