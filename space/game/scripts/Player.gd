extends CharacterBody2D
@export var speed := 280.0  # 40% faster (200 * 1.4 = 280)
@export var sprint_multiplier := 1.6  # Sprint is 60% faster than walking
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
var team_room_manager: Node = null  # Reference to TeamRoomManager for zone detection
var last_voice_position_update := 0.0  # Throttle voice position updates
# Collision shape is now defined in the Player.tscn scene file

func _ready():
	# Configure collision properties for better wall collision
	collision_layer = 1  # Player collision layer
	collision_mask = 1   # What the player can collide with
	floor_max_angle = 0  # Don't allow sliding on slopes (we're in 2D)
	
func _physics_process(delta: float) -> void:
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
	var input_dir := Vector2(
		Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
		Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	)
	
	if input_dir != Vector2.ZERO:
		# Check if sprinting (holding shift)
		var is_sprinting = Input.is_action_pressed("ui_accept") or Input.is_key_pressed(KEY_SHIFT)
		var current_speed = speed * (sprint_multiplier if is_sprinting else 1.0)
		
		velocity = input_dir * current_speed
		last_input_time = Time.get_time_dict_from_system().get("unix", 0.0)
		
		# Update animation speed based on movement speed
		if view.has_method("set_animation_speed"):
			var speed_ratio = current_speed / speed  # 1.0 for walking, sprint_multiplier for sprinting
			view.set_animation_speed(speed_ratio)
	else:
		velocity = Vector2.ZERO  # Stop if no input
		# Reset animation speed to normal when not moving
		if view.has_method("set_animation_speed"):
			view.set_animation_speed(1.0)
		
	# Store position before collision detection
	var old_position = global_position
	
	# Always call move_and_slide to apply physics
	move_and_slide()
	
	# Send ACTUAL movement delta to server (after collision resolution)
	if room != null:
		var actual_delta = global_position - old_position
		# Only send if there was actual movement (avoid spam when hitting walls)
		if actual_delta.length() > 0.1:
			room.send("move", {"x": actual_delta.x, "y": actual_delta.y})
			
			# Optional: Send periodic heartbeat for sync
			# room.send("position_heartbeat", {"x": global_position.x, "y": global_position.y})
	
	if view.has_method("update_from_velocity"):
		view.update_from_velocity(velocity)  # Use the actual velocity
	
	# Update local player position in VoiceChat for proximity calculations
	_update_voice_chat_position()
	
	# Check for team room entry/exit based on position
	_check_team_room_zones()

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

func set_team_room_manager_reference(manager: Node) -> void:
	"""Set the TeamRoomManager reference for zone detection"""
	team_room_manager = manager

func _check_team_room_zones() -> void:
	"""Check if local player should enter/exit team rooms based on position"""
	if not is_local_player or not team_room_manager:
		return
	
	# Only check zones for local player
	if team_room_manager.has_method("check_team_room_entry"):
		team_room_manager.check_team_room_entry(global_position)

# All audio processing functions removed - WebRTC handles audio automatically!
# Player now only handles position updates for proximity audio calculations
