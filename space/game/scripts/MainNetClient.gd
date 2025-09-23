# res://scripts/MainNetClient.gd
extends Node2D

# @export var server_url: String = "ws://localhost:2567"
@export var server_url: String = "wss://moondao-space-server.fly.dev"
@export var room_name: String  = "lobby"

const PLAYER_SCENE_PATH        := "res://scenes/Player.tscn"
const ROOM_STATE_SCHEMA_PATH   := "res://scripts/schemas/RoomStateSchema.gd"

# Only the runtime client (NOT the editor plugin). Preload so it's bundled in export.
const COLYSEUS_CLIENT: GDScript = preload("res://addons/godot_colyseus/lib/client.gd")

var client: Object = null
var room: Object = null
var players: Dictionary = {}   # sessionId -> Player instance
var last_pos: Dictionary = {}  # sessionId -> Vector2 (for anim velocity)
var last_input: Vector2 = Vector2.ZERO  # Track last input to avoid spam

# Add these variables for proper session management
var is_connecting: bool = false
var connection_timeout_timer: Timer
var max_connection_attempts: int = 3
var current_attempt: int = 0

@onready var actors: Node2D = $Actors
@onready var cam: Camera2D = _ensure_camera()
@onready var voice_chat: Node = $VoiceChat
var _follow: Node2D = null     # local player to follow

# Fallbacks to ensure you SEE something
var _dummy_timer := 0.0
var _dummy_spawned := false
var _connection_failed := false  # Track if connection failed to prevent dummy spawning

# Authentication data
var auth_token: String = ""
var is_dev_mode: bool = false
var connection_allowed: bool = false

func _ready() -> void:
	# Add to group so background can find this node
	add_to_group("main_client")
	
	# DISABLED: AudioTest was causing "always on" microphone
	# print("MainNetClient: Adding microphone test...")
	# var audio_test = load("res://scripts/AudioTest.gd").new()
	# add_child(audio_test)
	print("MainNetClient: AudioTest disabled - no automatic microphone activation")
	
	# Disable processing until connection succeeds
	set_process(false)
	
	# TEST: Show error immediately for debugging
	# Uncomment this line to test if error display works:
	# call_deferred("_create_duplicate_session_error_display")
	
	# --- 1) Actors container sanity
	if actors == null:
		push_error("MainNetClient: Missing child node 'Actors' (Node2D). Create it under Main and enable Y Sort.")
		return
	actors.y_sort_enabled = true

	# --- 2) Check authentication and connect
	_check_authentication_and_connect()

func _check_authentication_and_connect() -> void:
	print("MainNetClient: Checking authentication...")
	
	# Check if we're in dev mode (debug build from Godot editor)
	if OS.is_debug_build():
		print("MainNetClient: Debug build detected - bypassing auth")
		is_dev_mode = true
		connection_allowed = true
		_connect_to_server()
		return
	
	# Check for token in URL hash
	var tk := _get_token_from_hash()
	print("MainNetClient: 🔍 DEBUG - Token from hash: ", tk.substr(0, 20) + "..." if tk.length() > 20 else tk)
	if tk != "":
		print("MainNetClient: Token found in URL hash")
		auth_token = tk
		connection_allowed = true
		_connect_to_server()
		return
	
	# No token and not dev mode - show error
	print("MainNetClient: ❌ No authentication token found")
	_show_auth_required_error()

func _connect_to_server() -> void:
	if not connection_allowed:
		print("MainNetClient: Connection not allowed - authentication required")
		return
	
	if is_connecting:
		print("MainNetClient: Already connecting, ignoring duplicate request")
		return
	
	current_attempt += 1
	if current_attempt > max_connection_attempts:
		print("MainNetClient: Max connection attempts reached")
		_handle_connection_failure()
		return
	
	is_connecting = true
	print("MainNetClient: Starting server connection attempt ", current_attempt)
	
	# Setup connection timeout
	if not connection_timeout_timer:
		connection_timeout_timer = Timer.new()
		add_child(connection_timeout_timer)
		connection_timeout_timer.timeout.connect(_on_connection_timeout)
	
	connection_timeout_timer.wait_time = 10.0  # 10 second timeout
	connection_timeout_timer.start()
	
	var url := _resolve_server_url()
	print("MainNetClient: connecting to ", url, " room=", room_name)
	
	# Create client if needed
	if client == null:
		client = _new_client(url)
		if not client:
			print("MainNetClient: ❌ Failed to create Colyseus client")
			_handle_connection_failure()
			return
	
	# Connection options
	var options = {}
	if not is_dev_mode:
		options["token"] = auth_token
	
	print("MainNetClient: 🔍 Attempting to join room...")
	
	var ROOM_STATE_SCHEMA_REF: GDScript = preload(ROOM_STATE_SCHEMA_PATH)
	var promise = client.join_or_create(ROOM_STATE_SCHEMA_REF, room_name, options)
	if promise == null:
		print("MainNetClient: ❌ Failed to create connection promise")
		_handle_connection_failure()
		return
	
	# Use the new promise-based approach with proper error handling
	await promise.completed
	
	if promise.get_state() == promise.State.Failed:
		_on_room_join_error(promise.get_error())
	else:
		_on_room_joined(promise.get_data())

func _on_room_joined(new_room) -> void:
	is_connecting = false
	current_attempt = 0  # Reset on success
	
	if connection_timeout_timer:
		connection_timeout_timer.stop()
	
	print("MainNetClient: ✅ Successfully connected to room!")
	room = new_room
	_setup_room_handlers()
	set_process(true)
	
	# In dev mode, allow dummy players for testing
	if is_dev_mode:
		print("MainNetClient: Dev mode - enabling dummy player spawn")
		_dummy_spawned = false  # Allow dummy spawning in dev mode
	else:
		_dummy_spawned = true   # Prevent dummy spawning in production
	
	# Ensure we sync from state shortly after join (in case initial patch arrives a tick later)
	call_deferred("_debug_post_join")

func _setup_room_handlers() -> void:
	if not room:
		return
		
	room.on_join.on(Callable(self, "_on_join"))
	room.on_state_change.on(Callable(self, "_on_state_change"))
	# WebRTC handles voice data directly, no need for message handler
	room.on_message("duplicate_session").on(Callable(self, "_on_duplicate_session"))
	room.on_error.on(Callable(self, "_on_room_error"))
	room.on_leave.on(Callable(self, "_on_room_leave"))
	
	# Setup WebRTC voice chat
	if voice_chat:
		voice_chat.set_room(room)
		voice_chat.set_main_net_client(self)  # Set reference for player access
		
		# player_talking_changed signal connection removed
	
	# Expose room to JavaScript for WebRTC signaling
	if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
		JavaScriptBridge.eval("window.godotColyseusRoom = window.colyseusRoom || null;")
		# We'll set the actual room reference when we have it available
		_expose_room_to_javascript()
	
	print("MainNetClient: joined room: ", room_name)

func _on_room_join_error(error) -> void:
	is_connecting = false
	
	if connection_timeout_timer:
		connection_timeout_timer.stop()
	
	print("MainNetClient: ❌ Failed to join room: ", error)
	
	# Check if it's a duplicate session error
	if str(error).find("duplicate") != -1:
		print("MainNetClient: Detected duplicate session, waiting before retry...")
		# Wait longer before retry for duplicate sessions
		await get_tree().create_timer(3.0).timeout
	else:
		# Wait shorter for other errors
		await get_tree().create_timer(1.0).timeout
	
	_connect_to_server()  # Retry

func _on_connection_timeout() -> void:
	print("MainNetClient: ⏰ Connection timeout")
	is_connecting = false
	
	if client:
		if client.has_method("close"):
			client.close()
		client = null
	
	# Wait before retry
	await get_tree().create_timer(2.0).timeout
	_connect_to_server()

func _handle_connection_failure() -> void:
	is_connecting = false
	current_attempt = 0
	_connection_failed = true
	print("MainNetClient: 💥 Connection failed permanently")
	
	# Show error UI to user - for now show duplicate session error
	# You might want to create a more specific "connection failed" error
	call_deferred("_create_duplicate_session_error_display")

func _handle_auth_failure(error_msg: String) -> void:
	print("MainNetClient: Authentication failed: ", error_msg)
	
	# Check if this is specifically a duplicate session case
	# For now, just show the duplicate session error for any auth failure
	# since our main use case is preventing duplicate sessions
	print("MainNetClient: 🔍 Treating auth failure as duplicate session")
	call_deferred("_create_duplicate_session_error_display")
	return

func _show_auth_required_error() -> void:
	print("MainNetClient: ❌❌❌ AUTHENTICATION REQUIRED ❌❌❌")
	print("MainNetClient: This game requires authentication to play.")
	print("MainNetClient: Please access the game through the official MoonDAO website at /space")
	print("MainNetClient: Direct access to /space-client/ is not allowed in production.")
	
	# Prevent game from continuing - stop all processing
	set_process(false)
	
	# Show error message in game (simple text for now)
	_create_auth_error_display()

func _create_auth_error_display() -> void:
	# Create a simple UI overlay to show the authentication error
	var error_layer = CanvasLayer.new()
	error_layer.layer = 100  # High layer to appear on top
	add_child(error_layer)
	
	# Full screen background to completely hide the game
	var background = ColorRect.new()
	background.color = Color(0.1, 0.1, 0.2, 1.0)  # Solid dark blue background
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	error_layer.add_child(background)
	
	# Main container - centers everything
	var container = CenterContainer.new()
	container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	error_layer.add_child(container)
	
	# Text container - vertical layout for title and message
	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 20)  # Space between title and message
	container.add_child(vbox)
	
	# Title
	var title = Label.new()
	title.text = "🔒 Authentication Required"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 64)
	title.add_theme_color_override("font_color", Color.WHITE)
	vbox.add_child(title)
	
	# Message
	var message = Label.new()
	message.text = "This game requires authentication.\nPlease access through the official MoonDAO Space at /space"
	message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	message.add_theme_font_size_override("font_size", 32)
	message.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8, 1.0))
	vbox.add_child(message)
	
	print("MainNetClient: Auth error display created")

func _process(delta: float) -> void:
	# Spawn a guaranteed dummy after 1s if we haven't seen any server players.
	# But NOT if connection failed (e.g., duplicate session)
	if not _dummy_spawned and not _connection_failed:
		_dummy_timer += delta
		if _dummy_timer > 1.0 and players.size() == 0:
			_spawn_dummy_player()
			_dummy_spawned = true
			print("MainNetClient: spawned local dummy so you can see something.")

	# Note: Input processing moved to Player.gd to avoid double movement
	# Player.gd handles both local movement and sending updates to server

	# Direct camera follow (no smoothing to prevent background sync issues)
	if _follow != null and cam != null:
		cam.global_position = _follow.global_position

	# Fallback: proactively sync from current room state
	if room != null:
		var s = room.state
		if s != null:
			_sync_from_state(s)

func _on_state_change(state) -> void:
	var players_map = state.get("players") if state.has_method("get") else state.players
	var count = players_map.size() if players_map != null else 0
	print("State change: players=", count)
	_sync_from_state(state)

func _on_join():
	print("Room on_join signalled")
	# sync from current room state on join
	if room != null:
		var s = room.state
		if s != null:
			_sync_from_state(s)

func _debug_post_join():
	if room == null:
		return
	await get_tree().process_frame
	if room != null and room.state != null:
		var s = room.state
		var players_map = s.get("players") if s.has_method("get") else s.players
		var count = players_map.size() if players_map != null else 0
		print("Post-join state: players=", count, " mySession=", room.session_id)
		_sync_from_state(s)

func _sync_from_state(state) -> void:
	if state == null:
		return
	
	# Access players MapSchema - use get() or direct property access
	var players_map
	if state.has_method("get"):
		players_map = state.get("players")
	else:
		players_map = state.players
	
	if players_map == null:
		return
	
	# Spawn any missing players
	for sid in players_map.keys():
		if not players.has(sid):
			var inst_ps: PackedScene = preload(PLAYER_SCENE_PATH)
			var inst: Node2D = inst_ps.instantiate()
			
			# Set session ID and player type FIRST
			var is_local = (room != null and sid == room.session_id)
			if inst.has_method("set_session_id"):
				inst.set_session_id(sid)
			if inst.has_method("set_local_player"):
				inst.set_local_player(is_local)
			
			# Set initial position immediately to avoid overlapping at (0,0)
			var p0 = players_map.at(sid)
			if ("x" in p0) and ("y" in p0):
				var spawn_pos := Vector2(float(p0.x), float(p0.y))
				inst.global_position = spawn_pos
				# Also initialize the network position for proper synchronization
				if inst.has_method("set_network_position"):
					inst.set_network_position(spawn_pos)
				print("Player ", sid, " (", "LOCAL" if is_local else "REMOTE", ") spawned directly at server position: ", spawn_pos)
			
			actors.add_child(inst)
			players[sid] = inst
			
			# Set WebRTC VoiceChat reference for proximity calculations
			if inst.has_method("set_voice_chat_reference") and voice_chat:
				inst.set_voice_chat_reference(voice_chat)
			
			# Set room reference for sending movement updates (local player only)
			if is_local and inst.has_method("set_room_reference"):
				inst.set_room_reference(room)
			
			if inst.has_method("set_name_text"):
				var nm := ""
				if ("name" in p0) and (p0.name is String):
					nm = p0.name
				inst.set_name_text(nm)
			if is_local:
				_follow = inst
	# Update positions
	for sid in players_map.keys():
		var node: Node2D = players.get(sid, null)
		if node == null: continue
		var p = players_map.at(sid)
		if ("x" in p) and ("y" in p):
			var next := Vector2(float(p.x), float(p.y))
			
			# Always use set_network_position for proper interpolation and prediction
			if node.has_method("set_network_position"):
				node.set_network_position(next)
			else:
				# Fallback: direct position setting (should not happen with Player nodes)
				print("Warning: Node ", node.name, " doesn't have set_network_position method, using direct positioning")
				node.global_position = next
			last_pos[sid] = next
			
			# Update voice chat position for proximity audio
			if voice_chat:
				var is_local = (room != null and sid == room.session_id)
				if is_local:
					voice_chat.update_local_player_position(next)
				else:
					voice_chat.update_player_position(sid, next)
	# Remove players not present
	var to_remove: Array = []
	for existing_sid in players.keys():
		if not players_map.has(existing_sid):
			to_remove.append(existing_sid)
	for dead in to_remove:
		var n: Node = players[dead]
		if is_instance_valid(n):
			n.queue_free()
		players.erase(dead)
		last_pos.erase(dead)
	if _follow != null and not players.values().has(_follow):
		_follow = null

# Voice data is now handled directly by WebRTC - no server relay needed
# This function is kept for compatibility but is no longer used
func _on_voice_data(_data) -> void:
	print("MainNetClient: Legacy voice_data message received, but WebRTC handles audio directly")

func _expose_room_to_javascript() -> void:
	"""Expose the Colyseus room to JavaScript for WebRTC signaling"""
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	
	# Create a JavaScript wrapper for the room that can send messages
	var js_room_wrapper = """
	window.godotColyseusRoom = {
		send: function(messageType, data) {
			// This will be called from JavaScript to send WebRTC signaling messages
			console.log('🌐 JavaScript sending message to Colyseus:', messageType, data);
			
			// Store the message to be picked up by Godot
			if (!window.webrtcSignalingQueue) {
				window.webrtcSignalingQueue = [];
			}
			const message = {
				type: messageType,
				data: data,
				timestamp: Date.now()
			};
			window.webrtcSignalingQueue.push(message);
			console.log('🎤 Added to WebRTC queue:', messageType, 'Queue size:', window.webrtcSignalingQueue.length);
		}
	};
	
	console.log('✅ Godot Colyseus room wrapper created for WebRTC');
	"""
	
	JavaScriptBridge.eval(js_room_wrapper)
	
	# Set up polling for WebRTC signaling messages from JavaScript
	print("MainNetClient: 🎤 Creating WebRTC signaling timer...")
	var signaling_timer = Timer.new()
	signaling_timer.wait_time = 0.05  # Check every 50ms
	signaling_timer.timeout.connect(_process_webrtc_signaling_queue)
	signaling_timer.autostart = true
	add_child(signaling_timer)
	print("MainNetClient: ✅ WebRTC signaling timer created and started")

var _last_timer_debug: float = 0.0

func _process_webrtc_signaling_queue() -> void:
	"""Process WebRTC signaling messages from JavaScript"""
	# Debug: Print every 5 seconds to confirm timer is working
	var current_time = Time.get_ticks_msec() / 1000.0
	if current_time - _last_timer_debug > 5.0:
		print("MainNetClient: 🎤 WebRTC signaling timer alive (checking every 50ms)")
		_last_timer_debug = current_time
	
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	if not room:
		# print("MainNetClient: 🎤 No room available for WebRTC signaling")
		return
	
	var js_check_queue = """
	(function() {
		if (!window.webrtcSignalingQueue) {
			console.log('🎤 Queue check: webrtcSignalingQueue does not exist');
			return null;
		}
		if (window.webrtcSignalingQueue.length === 0) {
			// console.log('🎤 Queue check: queue is empty');
			return null;
		}
		
		const message = window.webrtcSignalingQueue.shift();
		console.log('🎤 Dequeued message:', message.type, 'Queue size now:', window.webrtcSignalingQueue.length);
		
		// Return as JSON string for Godot to parse
		const messageData = {
			type: message.type,
			data: message.data,
			timestamp: message.timestamp
		};
		const jsonString = JSON.stringify(messageData);
		console.log('🎤 Returning JSON to Godot:', jsonString);
		return jsonString;
	})();
	"""
	
	var json_string = JavaScriptBridge.eval(js_check_queue)
	if json_string and json_string is String:
		print("MainNetClient: 🎤 Received JSON from JavaScript: ", json_string)
		
		# Parse JSON string to Dictionary
		var json_parser = JSON.new()
		var parse_result = json_parser.parse(json_string)
		
		if parse_result == OK:
			var message = json_parser.data
			print("MainNetClient: 🎤 Parsed WebRTC signaling message: ", message)
			print("MainNetClient: 🎤 Message type: ", message.get("type", "unknown"))
			print("MainNetClient: 🎤 Message data: ", message.get("data", {}))
			
			if message.has("type") and message.has("data"):
				# Send the message through the actual Colyseus room
				var msg_type = message.get("type")
				var msg_data = message.get("data")
				room.send(msg_type, msg_data)
				print("MainNetClient: 🎤 Forwarded WebRTC signaling message: ", msg_type, " to: ", msg_data.get("targetSessionId", "unknown"))
			else:
				print("MainNetClient: ❌ Invalid WebRTC message format: ", message)
		else:
			print("MainNetClient: ❌ Failed to parse JSON: ", json_string)
	elif json_string:
		print("MainNetClient: 🎤 Received non-string from JavaScript: ", json_string, " type: ", type_string(typeof(json_string)))

func _on_duplicate_session(data) -> void:
	print("MainNetClient: 🔍 DUPLICATE SESSION MESSAGE RECEIVED: ", data)
	print("MainNetClient: 🔍 About to show duplicate session error...")
	_show_duplicate_session_error()
	print("MainNetClient: 🔍 Duplicate session error display should be showing now")

func _on_room_error(error_data) -> void:
	print("MainNetClient: Room error: ", error_data)
	var error_code = 0
	var error_message = "Unknown error"
	
	if error_data is Array and error_data.size() >= 2:
		error_code = error_data[0]
		error_message = str(error_data[1])
	elif error_data is Dictionary:
		error_code = error_data.get("code", 0)
		error_message = str(error_data.get("message", "Unknown error"))
	else:
		error_message = str(error_data)
	
	print("MainNetClient: Error code: ", error_code, " message: ", error_message)

func _on_room_leave(code: int = 0) -> void:
	print("MainNetClient: 🔍 DISCONNECT DEBUG - Room leave with code: ", code)
	print("MainNetClient: 🔍 DISCONNECT DEBUG - Code type: ", typeof(code))
	
	# Check if this is a duplicate session disconnection
	if code == 4001:
		print("MainNetClient: 🔍 DISCONNECT DEBUG - Duplicate session code detected!")
		_show_duplicate_session_error()
	else:
		print("MainNetClient: 🔍 DISCONNECT DEBUG - Normal disconnect (code: ", code, ")")

func _show_duplicate_session_error() -> void:
	print("MainNetClient: ❌ DUPLICATE SESSION DETECTED ❌")
	print("MainNetClient: Another session was started with this account.")
	print("MainNetClient: 🔍 About to stop processing and create error display...")
	
	# Prevent game from continuing and stop all timers/processes
	set_process(false)
	set_physics_process(false)
	_dummy_spawned = true  # Make sure no dummy spawning happens
	
	# Show error message in game
	print("MainNetClient: 🔍 Calling _create_duplicate_session_error_display()...")
	_create_duplicate_session_error_display()
	print("MainNetClient: 🔍 Error display creation completed")

func _create_duplicate_session_error_display() -> void:
	print("MainNetClient: 🔍 Creating duplicate session error display...")
	print("MainNetClient: 🔍 Node tree ready: ", is_inside_tree())
	print("MainNetClient: 🔍 Node name: ", name)
	
	# STOP EVERYTHING IMMEDIATELY
	set_process(false)
	set_physics_process(false)
	_dummy_spawned = true
	_connection_failed = true
	
	# Create a simple UI overlay to show the duplicate session error
	var error_layer = CanvasLayer.new()
	error_layer.layer = 100  # High layer to appear on top
	add_child(error_layer)
	print("MainNetClient: 🔍 Error layer added to scene tree")
	print("MainNetClient: 🔍 Error layer children count: ", error_layer.get_child_count())
	
	# Full screen background to completely hide the game
	var background = ColorRect.new()
	background.color = Color(0.2, 0.1, 0.1, 1.0)  # Solid dark red background
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	error_layer.add_child(background)
	
	# Main container - centers everything
	var container = CenterContainer.new()
	container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	error_layer.add_child(container)
	
	# Text container - vertical layout for title and message
	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 30)
	container.add_child(vbox)
	
	# Title
	var title = Label.new()
	title.text = "⚠️ DUPLICATE SESSION"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 48)
	title.add_theme_color_override("font_color", Color(1.0, 0.4, 0.4, 1.0))
	vbox.add_child(title)
	
	# Message
	var message = Label.new()
	message.text = "Another session was started with this account.\nOnly one session per account is allowed.\n\nPlease close this window and use the other session,\nor refresh this page to reconnect."
	message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	message.add_theme_font_size_override("font_size", 24)
	message.add_theme_color_override("font_color", Color(0.9, 0.9, 0.9, 1.0))
	vbox.add_child(message)
	
	print("MainNetClient: Duplicate session error display created")

# --------- helpers ---------

func _new_client(url: String):
	if COLYSEUS_CLIENT == null:
		push_error("MainNetClient: Colyseus client script not found. Ensure addons are included in export.")
		return null
	var c = COLYSEUS_CLIENT.new(url)
	
	# Try to configure WebSocket buffer size if possible
	if c.has_method("set_websocket_buffer_size"):
		c.set_websocket_buffer_size(65536)  # 64KB buffer
		print("MainNetClient: Set WebSocket buffer to 64KB")
	elif c.has_method("configure"):
		c.configure({"websocket_buffer_size": 65536})
		print("MainNetClient: Configured WebSocket buffer to 64KB")
	else:
		print("MainNetClient: Cannot configure WebSocket buffer - using defaults")
	
	return c

func _build_url_with_token(base_url: String) -> String:
	# Keep WS URL clean; token is sent via join options.
	return base_url

func _resolve_server_url() -> String:
	# 1) ws override from hash params (e.g., #token=...&ws=wss://host:port/path)
	var ws_override := _get_ws_from_hash()
	if ws_override != "":
		return _build_url_with_token(ws_override)
	# 2) Explicit export var
	if server_url != null and server_url != "":
		return _build_url_with_token(server_url)
	# 3) Derive from page context (useful in Web export)
	if Engine.has_singleton("JavaScriptBridge"):
		var proto_any: Variant = JavaScriptBridge.eval("(window && window.location && window.location.protocol) ? String(window.location.protocol) : ''")
		var host_any: Variant = JavaScriptBridge.eval("(window && window.location) ? (window.location.hostname || window.location.host || '') : ''")
		var proto: String = "http:"
		if (proto_any is String) and proto_any != "":
			proto = proto_any
		var host: String = "127.0.0.1"
		if (host_any is String) and host_any != "":
			host = host_any
		var use_wss := (proto == "https:")
		var scheme := "wss" if use_wss else "ws"
		var url := scheme + "://" + host
		return _build_url_with_token(url)
	# 4) Fallback to localhost (with base path)
	return _build_url_with_token("ws://127.0.0.1:2567")

func _get_token_from_hash() -> String:
	var params := _parse_hash_params()
	if params.has("token"):
		return str(params["token"]) 
	return ""

func _get_ws_from_hash() -> String:
	var params := _parse_hash_params()
	if params.has("ws"):
		return str(params["ws"]) 
	return ""

func _parse_hash_params() -> Dictionary:
	var result: Dictionary = {}
	if not Engine.has_singleton("JavaScriptBridge"):
		return result
	var raw: Variant = JavaScriptBridge.eval("(window && window.location && window.location.hash) ? String(window.location.hash).substring(1) : ''")
	if not (raw is String):
		return result
	for pair in (raw as String).split("&", false):
		if pair == "":
			continue
		var kv := pair.split("=", false, 1)
		var key := kv[0]
		var val := kv[1] if kv.size() > 1 else ""
		result[key] = val
	return result

func _spawn_dummy_player() -> void:
	var ps: PackedScene = preload(PLAYER_SCENE_PATH)
	if ps == null:
		push_error("MainNetClient: Could not load Player.tscn at " + PLAYER_SCENE_PATH)
		return
	var inst: Node2D = ps.instantiate()
	actors.add_child(inst)
	if inst.has_method("set_name_text"):
		inst.set_name_text("Local Dummy")
	# place near center so camera can find it until server state arrives
	var center := get_viewport_rect().size * 0.5
	if inst.has_method("set_pos"):
		inst.set_pos(center.x, center.y)
	else:
		inst.global_position = center
	# follow the dummy until the server spawns the real player
	if _follow == null:
		_follow = inst

func _ensure_camera() -> Camera2D:
	var c := get_node_or_null("Camera2D") as Camera2D
	if c == null:
		c = Camera2D.new()
		c.name = "Camera2D"
		add_child(c)

	# make it active and disable smoothing to fix background sync
	c.make_current()
	c.position_smoothing_enabled = false  # Disabled to prevent background floating
	c.position_smoothing_speed = 10.0
	# Optional zoom or limits can go here
	return c

func get_local_player() -> Node2D:
	"""Return the local player node for background synchronization"""
	return _follow

func get_players() -> Dictionary:
	"""Return the players dictionary for minimap"""
	return players

# _on_player_talking_changed function removed
