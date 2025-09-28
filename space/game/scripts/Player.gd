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

# Mobile joystick input
var joystick_input_vector: Vector2 = Vector2.ZERO
var ui_node: Node = null  # Reference to UI for joystick input

func _ready():
	# Configure collision properties for better wall collision
	collision_layer = 1  # Player collision layer
	collision_mask = 1   # What the player can collide with
	floor_max_angle = 0  # Don't allow sliding on slopes (we're in 2D)
	
	print("Player: _ready() called - is_local_player: ", is_local_player)
	
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
	# Handle WASD, arrow keys, and mobile joystick input
	var horizontal_input = 0.0
	var vertical_input = 0.0
	
	# Debug: Show current joystick input vector
	if joystick_input_vector != Vector2.ZERO:
		print("Player: Current joystick_input_vector: ", joystick_input_vector)
	
	# Debug: Test connection on T key press
	if Input.is_action_just_pressed("ui_accept") and Input.is_key_pressed(KEY_T):
		print("Player: Manual connection test triggered!")
		_connect_to_ui()
	
	# Get joystick input via global variable (most reliable approach)
	var joystick_vector = Vector2.ZERO
	var joystick_is_sprinting = false
	
	if get_tree().has_meta("joystick_input"):
		joystick_vector = get_tree().get_meta("joystick_input")
		if get_tree().has_meta("joystick_is_sprinting"):
			joystick_is_sprinting = get_tree().get_meta("joystick_is_sprinting")
		
		# Removed excessive debug logging
	
	# Priority order: joystick > WASD > arrow keys
	var is_using_joystick = joystick_vector.length() > 0.0
	if is_using_joystick:
		# Use joystick input (mobile)
		horizontal_input = joystick_vector.x
		vertical_input = joystick_vector.y
	else:
		# Horizontal movement (prioritize WASD, fall back to arrows)
		if Input.is_key_pressed(KEY_D):
			horizontal_input = 1.0
		elif Input.is_key_pressed(KEY_A):
			horizontal_input = -1.0
		else:
			horizontal_input = Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left")
		
		# Vertical movement (prioritize WASD, fall back to arrows)
		if Input.is_key_pressed(KEY_S):
			vertical_input = 1.0
		elif Input.is_key_pressed(KEY_W):
			vertical_input = -1.0
		else:
			vertical_input = Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	
	var input_dir := Vector2(horizontal_input, vertical_input)
	
	if input_dir != Vector2.ZERO:
		# Check if sprinting (keyboard shift OR joystick at high intensity)
		var keyboard_sprint = Input.is_action_pressed("ui_accept") or Input.is_key_pressed(KEY_SHIFT)
		var is_sprinting = keyboard_sprint or (is_using_joystick and joystick_is_sprinting)
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
	print("Player: Set as local player: ", is_local, " - Node path: ", get_path())
	
	# Connect to UI joystick when we become the local player
	if is_local:
		call_deferred("_connect_to_ui")

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

func teleport_to_position(new_position: Vector2) -> void:
	"""Teleport player to a new position and sync with server"""
	if not is_local_player:
		print("⚠️ Warning: teleport_to_position called on non-local player")
		return
	
	var old_position = global_position
	global_position = new_position
	
	# Send position update to server for synchronization
	if room != null:
		# Try sending as teleport message first
		room.send("teleport", {"x": new_position.x, "y": new_position.y})
		print("📡 Sent teleport to server: (", new_position.x, ", ", new_position.y, ")")
		
		# Also send as large movement delta as fallback for servers that don't support teleport
		var delta = new_position - old_position
		if delta.length() > 0.1:
			room.send("move", {"x": delta.x, "y": delta.y})
			print("📡 Sent movement delta as teleport fallback: (", delta.x, ", ", delta.y, ")")
	else:
		print("⚠️ Warning: Cannot sync teleport - no room connection")
	
	# Update voice chat position immediately
	_update_voice_chat_position()
	
	# Check for team room entry/exit
	_check_team_room_zones()
	
	print("✅ Teleported to position: (", new_position.x, ", ", new_position.y, ")")

func _check_team_room_zones() -> void:
	"""Check if local player should enter/exit team rooms based on position"""
	if not is_local_player or not team_room_manager:
		return
	
	# Only check zones for local player
	if team_room_manager.has_method("check_team_room_entry"):
		team_room_manager.check_team_room_entry(global_position)

# All audio processing functions removed - WebRTC handles audio automatically!
# Player now only handles position updates for proximity audio calculations

func _connect_to_ui() -> void:
	"""Connect to UI joystick input signal"""
	print("Player: Attempting to connect to UI joystick...")
	
	# Find the UI node
	ui_node = get_node_or_null("/root/Main/UI")
	if not ui_node:
		print("Player: UI not found at /root/Main/UI, searching...")
		# Try alternative paths
		var main_node = get_node_or_null("/root/Main")
		if main_node:
			print("Player: Found Main node, checking children...")
			for child in main_node.get_children():
				print("Player: Checking child: ", child.name, " - has joystick_input signal: ", child.has_signal("joystick_input"))
				if child.name == "UI" or child.has_signal("joystick_input"):
					ui_node = child
					print("Player: Found UI node: ", child.name)
					break
		else:
			print("Player: Could not find Main node")
	else:
		print("Player: Found UI node at /root/Main/UI")
	
	# Connect to joystick signal if UI found
	if ui_node and ui_node.has_signal("joystick_input"):
		if not ui_node.joystick_input.is_connected(_on_joystick_input):
			ui_node.joystick_input.connect(_on_joystick_input)
			print("Player: ✅ Successfully connected to UI joystick input!")
		else:
			print("Player: Already connected to joystick input")
	else:
		print("Player: ❌ Could not find UI node with joystick_input signal")
		if ui_node:
			print("Player: UI node found but no joystick_input signal")
		else:
			print("Player: No UI node found at all")

func _on_joystick_input(input_vector: Vector2) -> void:
	"""Handle joystick input from UI"""
	joystick_input_vector = input_vector
	print("Player: Received joystick input: ", input_vector)

func get_joystick_input() -> Vector2:
	"""Get current joystick input vector"""
	return joystick_input_vector
