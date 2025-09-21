# res://scripts/MainNetClient.gd
extends Node2D

@export var server_url: String = "ws://localhost:2567"
# @export var server_url: String = "wss://moondao-space.ayla.dev:2567"
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
	
	print("MainNetClient: Starting server connection...")
	
	var url := _resolve_server_url()
	print("MainNetClient: connecting to ", url, " room=", room_name)

	client = _new_client(url)
	if client == null:
		push_error("MainNetClient: Could not construct Colyseus client. Check addon path under 'addons/godot_colyseus/'.")
		return

	var ROOM_STATE_SCHEMA_REF: GDScript = preload(ROOM_STATE_SCHEMA_PATH)

	var opts: Dictionary = {}
	
	# Use auth token if we have one, otherwise check URL hash (for dev mode)
	if auth_token != "":
		opts["token"] = auth_token
		print("MainNetClient: Using provided auth token")
	else:
		var tk := _get_token_from_hash()
		if tk != "":
			opts["token"] = tk
			print("MainNetClient: Using token from URL hash")
		elif is_dev_mode:
			print("MainNetClient: Dev mode - connecting without token")
		else:
			push_error("MainNetClient: ❌ AUTHENTICATION REQUIRED - No token provided and not in dev mode")
			_show_auth_required_error()
			return
	
	var promise = client.join_or_create(ROOM_STATE_SCHEMA_REF, room_name, opts)
	print("MainNetClient: 🔍 Promise created, waiting for completion...")
	await promise.completed
	print("MainNetClient: 🔍 Promise completed, state: ", promise.get_state())
	
	if promise.get_state() == promise.State.Failed:
		var error_msg = str(promise.get_error())
		print("MainNetClient: ❌ Join failed: ", error_msg)
		
		# Simple approach: if connection fails, assume it's a duplicate session
		# (since that's our main restriction now)
		print("MainNetClient: 🔍 Connection failed - showing duplicate session error")
		call_deferred("_create_duplicate_session_error_display")
		return
	elif promise.get_state() == promise.State.Completed:
		print("MainNetClient: ✅ Connection succeeded!")
	else:
		print("MainNetClient: ⚠️ Unexpected promise state: ", promise.get_state())

	room = promise.get_data()
	room.on_join.on(Callable(self, "_on_join"))
	room.on_state_change.on(Callable(self, "_on_state_change"))
	room.on_message("voice_data").on(Callable(self, "_on_voice_data"))
	room.on_message("duplicate_session").on(Callable(self, "_on_duplicate_session"))
	room.on_error.on(Callable(self, "_on_room_error"))
	room.on_leave.on(Callable(self, "_on_room_leave"))
	
	# Setup voice chat (don't let it register its own message handler)
	if voice_chat:
		voice_chat.set_room(room, false)  # false = don't register message handler
		voice_chat.set_main_net_client(self)  # Set reference for player access
	
	print("MainNetClient: joined room: ", room_name)
	
	# Connection succeeded, enable processing
	set_process(true)
	
	# In dev mode, allow dummy players for testing
	if is_dev_mode:
		print("MainNetClient: Dev mode - enabling dummy player spawn")
		_dummy_spawned = false  # Allow dummy spawning in dev mode
	else:
		_dummy_spawned = true   # Prevent dummy spawning in production
	
	# Ensure we sync from state shortly after join (in case initial patch arrives a tick later)
	call_deferred("_debug_post_join")

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

	# Smooth-follow the local player with the camera
	if _follow != null and cam != null:
		cam.global_position = cam.global_position.lerp(_follow.global_position, 0.2)

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
			actors.add_child(inst)
			players[sid] = inst
			
			# Mark local vs remote player
			var is_local = (room != null and sid == room.session_id)
			if inst.has_method("set_local_player"):
				inst.set_local_player(is_local)
			
			if inst.has_method("set_session_id"):
				inst.set_session_id(sid)
			
			# Set VoiceChat reference for proximity calculations
			if inst.has_method("set_voice_chat_reference") and voice_chat:
				inst.set_voice_chat_reference(voice_chat)
			
			# Set room reference for sending movement updates (local player only)
			if is_local and inst.has_method("set_room_reference"):
				inst.set_room_reference(room)
			
			if inst.has_method("set_name_text"):
				var nm := ""
				var p0 = players_map.at(sid)
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
			
			# Use new prediction-aware positioning
			if node.has_method("set_network_position"):
				node.set_network_position(next)
			elif node.has_method("set_pos"):
				node.set_pos(next.x, next.y)
			else:
				node.global_position = next
			last_pos[sid] = next
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

func _on_voice_data(data) -> void:
	print("MainNetClient: 🔊 _on_voice_data called with data type: ", typeof(data))
	var sender_session_id = data.get("session_id", "")
	var format = data.get("format", "bytes")  # Default to bytes for backward compatibility
	
	print("MainNetClient: 🔊 Voice data from session: '", sender_session_id, "' format: ", format)
	print("MainNetClient: 🔊 Current players in room: ", players.keys())
	print("MainNetClient: 🔊 Total players: ", players.size())
	var my_session_id = ""
	if room != null:
		if room.has_method("get") and room.get("session_id") != null:
			my_session_id = str(room.get("session_id"))
		elif "session_id" in room:
			my_session_id = str(room.session_id)
		else:
			my_session_id = "unknown"
	print("MainNetClient: 🔊 My session ID: ", my_session_id)
	
	# IMPORTANT: Also forward to VoiceChat for proximity processing and UI updates
	if voice_chat and voice_chat.has_method("_on_voice_data_received"):
		voice_chat._on_voice_data_received(data)
		print("MainNetClient: 🔊 Forwarded voice data to VoiceChat")
	else:
		print("MainNetClient: ❌ Cannot forward to VoiceChat - ", "voice_chat is null" if not voice_chat else "method not found")
	
	# NOTE: Removed direct player audio calls - all voice data now goes through VoiceChat/VoiceUI

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
		var url := scheme + "://" + host + ":2567"
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

	# make it active and smooth
	c.make_current()
	c.position_smoothing_enabled = true
	c.position_smoothing_speed = 10.0
	# Optional zoom or limits can go here
	return c
