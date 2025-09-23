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
		# SIMPLE: Just use very fast interpolation - no teleport detection
		var distance_to_target = global_position.distance_to(network_position)
		
		if distance_to_target > 1.0:
			var old_pos = global_position
			# Use moderate interpolation speed that works well with animations
			global_position = global_position.lerp(network_position, 15.0 * delta)
			
			# Calculate velocity and update animations
			var velocity = (global_position - old_pos) / delta
			if view and view.has_method("update_from_velocity"):
				view.update_from_velocity(velocity)
			
			# Ensure sprite is visible
			if view and "sprite" in view and view.sprite:
				view.sprite.visible = true
		else:
			# Close enough - stop animating but keep visible
			if view and view.has_method("update_from_velocity"):
				view.update_from_velocity(Vector2.ZERO)
			if view and "sprite" in view and view.sprite:
				view.sprite.visible = true
		
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
		
		# Send movement delta to server for multiplayer sync
		if room != null:
			var input_dir := Vector2(
				Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
				Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
			)
			var delta_x = input_dir.x * delta * speed
			var delta_y = input_dir.y * delta * speed
			room.send("move", {"x": delta_x, "y": delta_y})
			
			# Optional: Send periodic heartbeat for sync
			# room.send("position_heartbeat", {"x": global_position.x, "y": global_position.y})
	
	if view.has_method("update_from_velocity"):
		view.update_from_velocity(v / delta)  # convert back to velocity
	
	# Update local player position in VoiceChat for proximity calculations
	_update_voice_chat_position()

func set_local_player(is_local: bool) -> void:
	is_local_player = is_local

func set_network_position(net_pos: Vector2) -> void:
	network_position = net_pos
	
	if not is_local_player:
		# For remote players: let _process() handle the interpolation
		pass
	else:
		# For local player, only reconcile if we haven't had input recently
		# This prevents server corrections from fighting local movement
		if Time.get_time_dict_from_system().get("unix", 0.0) - last_input_time > 0.1:
			var old_pos = global_position
			global_position = global_position.lerp(net_pos, 0.3)

func set_name_text(txt: String) -> void:
	if name_label == null:
		return
	name_label.text = txt if txt != null else ""

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