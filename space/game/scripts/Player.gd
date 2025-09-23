extends Node2D
@export var speed := 140.0
@onready var view: Node2D = $Astronaut
@onready var name_label: Label = $Label
# Talking indicator functionality removed
# Audio is now handled by WebRTC - no need for audio players in Player

var is_local_player := false
var network_position := Vector2.ZERO
var last_input_time := 0.0
var session_id := ""
var voice_chat_node: Node = null  # Reference to VoiceChat for proximity calculations
var room: Object = null  # Reference to room for sending movement updates
var last_voice_position_update := 0.0  # Throttle voice position updates

func _process(delta: float) -> void:
	if not is_local_player:
		# Non-local players: smooth interpolate to network position
		var old_pos = global_position
		var distance_to_target = global_position.distance_to(network_position)
		
		# Only interpolate if we're not already at the target
		if distance_to_target > 1.0:  # Small threshold to avoid micro-movements
			# Use adaptive interpolation speed based on distance
			# Closer players move more smoothly to reduce "jitter" when overlapping
			var lerp_speed = 8.0
			if distance_to_target < 50.0:  # If very close to target
				lerp_speed = 4.0  # Slower, smoother movement
			elif distance_to_target > 200.0:  # If far from target
				lerp_speed = 12.0  # Faster catch-up
			
			global_position = global_position.lerp(network_position, lerp_speed * delta)
			
			# Calculate velocity from the interpolated movement for animations
			var velocity = (global_position - old_pos) / delta
			if view.has_method("update_from_velocity"):
				view.update_from_velocity(velocity)
		else:
			# We're close enough to the target, stop animating
			if view.has_method("update_from_velocity"):
				view.update_from_velocity(Vector2.ZERO)
		
		# Update voice chat position (throttled to avoid spam)
		_update_voice_chat_position_throttled()
		return
	
	# Local player: immediate input response with client-side prediction
	var v := Vector2(
		Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
		Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	) * speed * delta

	if v != Vector2.ZERO:
		global_position += v  # Use global_position to match server coordinate system
		last_input_time = Time.get_time_dict_from_system().get("unix", 0.0)
		print("Local player moved to: ", global_position, " delta: ", v)
		
		# Send movement delta to server for multiplayer sync
		if room != null:
			var input_dir := Vector2(
				Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
				Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
			)
			var delta_x = input_dir.x * delta * speed
			var delta_y = input_dir.y * delta * speed
			room.send("move", {"x": delta_x, "y": delta_y})
	
	if view.has_method("update_from_velocity"):
		view.update_from_velocity(v / delta)  # convert back to velocity
	
	# Update local player position in VoiceChat for proximity calculations
	_update_voice_chat_position()

func set_local_player(is_local: bool) -> void:
	is_local_player = is_local
	if is_local:
		# Reset input time to prevent immediate reconciliation conflicts
		last_input_time = 0.0
		print("DEBUG: Set as local player - session_id: ", session_id)

func set_network_position(net_pos: Vector2) -> void:
	# Debug: Log all position updates to trace the sync issue
	print("DEBUG: ", session_id, " set_network_position called with: ", net_pos, " (current pos: ", global_position, ", is_local: ", is_local_player, ")")
	
	network_position = net_pos
	if not is_local_player:
		# For remote players, the position will be smoothly interpolated in _process()
		# But if this is the first position update, set it directly to avoid starting at (0,0)
		if global_position == Vector2.ZERO and network_position != Vector2.ZERO:
			print("DEBUG: Remote player initial position set to: ", network_position)
			global_position = network_position
	else:
		# For local player, only reconcile if we haven't had input recently
		# This prevents server corrections from fighting local movement
		var time_since_input = Time.get_time_dict_from_system().get("unix", 0.0) - last_input_time
		var distance_to_server = global_position.distance_to(net_pos)
		
		# Only reconcile if:
		# 1. No recent input (not actively moving), AND
		# 2. Server position is significantly different (> 10 pixels)
		if time_since_input > 0.1 and distance_to_server > 10.0:
			var old_pos = global_position
			# Use gentler reconciliation for smaller distances to reduce "snapping"
			var lerp_strength = 0.3
			if distance_to_server < 50.0:
				lerp_strength = 0.1  # Very gentle correction for small differences
			elif distance_to_server > 100.0:
				lerp_strength = 0.5  # Stronger correction for large differences
			
			global_position = global_position.lerp(net_pos, lerp_strength)
			print("Local player reconciled from ", old_pos, " to ", global_position, " (server says: ", net_pos, ", distance: ", distance_to_server.round(), ")")
		else:
			print("DEBUG: Local player reconciliation skipped - time_since_input: ", time_since_input, ", distance: ", distance_to_server)

func set_name_text(txt: String) -> void:
	if name_label == null:
		return
	name_label.text = txt if txt != null else ""

# Talking indicator functions removed

func set_session_id(sid: String) -> void:
	session_id = sid

func set_voice_chat_reference(voice_chat: Node) -> void:
	"""Set reference to VoiceChat node for proximity calculations"""
	voice_chat_node = voice_chat

func set_room_reference(room_ref: Object) -> void:
	"""Set reference to room for sending movement updates"""
	room = room_ref

func _update_voice_chat_position_throttled() -> void:
	"""Update voice chat position with throttling to avoid spam"""
	var current_time = Time.get_ticks_msec() / 1000.0
	
	# Throttle updates to max 10fps (every 0.1 seconds) instead of 60fps
	if current_time - last_voice_position_update < 0.1:
		return
	
	last_voice_position_update = current_time
	_update_voice_chat_position()

func _update_voice_chat_position() -> void:
	"""Update this player's position in the VoiceChat system"""
	if not voice_chat_node:
		return
	
	if is_local_player:
		if voice_chat_node.has_method("update_local_player_position"):
			voice_chat_node.update_local_player_position(global_position)
	else:
		if voice_chat_node.has_method("update_player_position") and session_id != "":
			voice_chat_node.update_player_position(session_id, global_position)

# All audio processing functions removed - WebRTC handles audio automatically!
# Player now only handles position updates for proximity audio calculations
