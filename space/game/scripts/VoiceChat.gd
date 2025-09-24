# res://scripts/VoiceChat.gd
# Compatibility wrapper for old VoiceChat - now delegates to WebRTCVoiceManager
extends Node

signal voice_data_received(session_id: String, audio_data: PackedByteArray)
signal microphone_ready_changed(is_ready: bool)
# player_talking_changed signal removed

# Compatibility properties
var is_recording := false
var voice_enabled := false
var proximity_range := 300.0

# Reference to the new WebRTC manager
var webrtc_manager: Node = null
var room: Object = null
var main_net_client: Node = null

func _ready() -> void:
	print("VoiceChat: Compatibility wrapper starting...")
	
	# Add to group so UI can find us
	add_to_group("voice_chat")
	
	# Use LiveKit SFU voice manager - lightweight and scalable
	print("VoiceChat: Looking for existing LiveKitVoiceManager...")
	webrtc_manager = get_node_or_null("../LiveKitVoiceManager")
	print("VoiceChat: Existing manager found: ", webrtc_manager != null)
	
	if not webrtc_manager:
		# Create LiveKit voice manager
		print("VoiceChat: Creating LiveKitVoiceManager...")
		print("VoiceChat: Loading script from res://scripts/LiveKitVoiceManager.gd...")
		
		var voice_script = load("res://scripts/LiveKitVoiceManager.gd")
		if voice_script:
			print("VoiceChat: ✅ Script loaded successfully")
			print("VoiceChat: Creating new instance...")
			webrtc_manager = voice_script.new()
			if webrtc_manager:
				print("VoiceChat: ✅ Instance created successfully")
				webrtc_manager.name = "LiveKitVoiceManager"
				print("VoiceChat: Adding as child to parent using call_deferred...")
				get_parent().call_deferred("add_child", webrtc_manager)
				print("VoiceChat: ✅ Scheduled to be added to scene tree")
				print("VoiceChat: Final check - manager exists: ", webrtc_manager != null)
				print("VoiceChat: ✅ Created LiveKitVoiceManager (SFU) - lightweight scalable solution")
			else:
				print("VoiceChat: ❌ Failed to create instance from script")
		else:
			print("VoiceChat: ❌ Failed to load LiveKitVoiceManager script!")
	else:
		print("VoiceChat: ✅ Found existing LiveKitVoiceManager")
	
	# Connect to voice manager signals (deferred if manager was just created)
	if webrtc_manager:
		# If manager was just created, defer signal connections until it's in the tree
		call_deferred("_connect_manager_signals")
	else:
		print("VoiceChat: ❌ No webrtc_manager available for signal connections")
	
	print("VoiceChat: ✅ Compatibility wrapper ready - delegating to LiveKitVoiceManager")

func _connect_manager_signals() -> void:
	"""Connect to voice manager signals - called deferred to ensure manager is in scene tree"""
	print("VoiceChat: Connecting signals - manager exists: ", webrtc_manager != null)
	if webrtc_manager:
		print("VoiceChat: Manager has voice_chat_enabled_changed signal: ", webrtc_manager.has_signal("voice_chat_enabled_changed"))
		print("VoiceChat: Manager has microphone_ready_changed signal: ", webrtc_manager.has_signal("microphone_ready_changed"))
		
		if webrtc_manager.has_signal("voice_chat_enabled_changed"):
			webrtc_manager.voice_chat_enabled_changed.connect(_on_webrtc_enabled_changed)
			print("VoiceChat: ✅ Connected to voice_chat_enabled_changed signal")
		else:
			print("VoiceChat: ❌ Could not connect to voice_chat_enabled_changed signal")
		
		# Connect to microphone ready signal
		if webrtc_manager.has_signal("microphone_ready_changed"):
			webrtc_manager.microphone_ready_changed.connect(_on_webrtc_microphone_ready_changed)
			print("VoiceChat: ✅ Connected to microphone_ready_changed signal")
		else:
			print("VoiceChat: ❌ Could not connect to microphone_ready_changed signal")
	else:
		print("VoiceChat: ❌ No webrtc_manager available for signal connections")

func _on_webrtc_enabled_changed(enabled: bool) -> void:
	"""Update local state when WebRTC manager changes"""
	voice_enabled = enabled
	is_recording = enabled

func _on_webrtc_microphone_ready_changed(is_ready: bool) -> void:
	"""Forward microphone ready signal from WebRTC manager to UI"""
	print("VoiceChat: 🎤 Microphone ready changed to: ", is_ready, " - forwarding to UI")
	microphone_ready_changed.emit(is_ready)

# _on_webrtc_talking_changed function removed

# Compatibility methods that delegate to WebRTC manager

func get_voice_enabled() -> bool:
	if webrtc_manager:
		return webrtc_manager.get_voice_enabled()
	return voice_enabled

func get_is_recording() -> bool:
	if webrtc_manager:
		return webrtc_manager.get_is_recording()
	return is_recording

func set_voice_enabled(enabled: bool) -> void:
	print("VoiceChat: set_voice_enabled called with: ", enabled)
	print("VoiceChat: webrtc_manager exists: ", webrtc_manager != null)
	if webrtc_manager:
		print("VoiceChat: Delegating to LiveKitVoiceManager...")
		webrtc_manager.set_voice_enabled(enabled)
		print("VoiceChat: Delegation complete")
	else:
		print("VoiceChat: ❌ No webrtc_manager available!")
	voice_enabled = enabled
	is_recording = enabled

func start_recording() -> void:
	print("VoiceChat: start_recording() called - delegating to WebRTC")
	if webrtc_manager:
		webrtc_manager.set_voice_enabled(true)

func stop_recording() -> void:
	print("VoiceChat: stop_recording() called - delegating to WebRTC")
	if webrtc_manager:
		webrtc_manager.set_voice_enabled(false)

func start_microphone() -> void:
	print("VoiceChat: start_microphone() called - delegating to WebRTC")
	if webrtc_manager:
		webrtc_manager.set_voice_enabled(true)

func stop_microphone() -> void:
	print("VoiceChat: stop_microphone() called - delegating to WebRTC")
	if webrtc_manager:
		webrtc_manager.set_voice_enabled(false)

func set_room(colyseus_room: Object, _register_handler: bool = true) -> void:
	print("VoiceChat: 🎤 set_room called with: ", colyseus_room)
	room = colyseus_room
	
	if webrtc_manager:
		print("VoiceChat: 🎤 Delegating room to LiveKitVoiceManager...")
		webrtc_manager.set_room(colyseus_room)
		print("VoiceChat: 🎤 Room delegated successfully")
	else:
		print("VoiceChat: ❌ No LiveKit manager to delegate room to! Deferring room setup...")
		# If manager isn't ready yet, defer the room setup
		call_deferred("_deferred_room_setup", colyseus_room)
	print("VoiceChat: Room set - delegated to LiveKitVoiceManager")

func _deferred_room_setup(colyseus_room: Object) -> void:
	"""Deferred room setup for when LiveKit manager isn't ready immediately"""
	if webrtc_manager:
		print("VoiceChat: 🔄 Deferred room setup - delegating to LiveKitVoiceManager...")
		webrtc_manager.set_room(colyseus_room)
		
		# Connect signals if they weren't connected before
		if webrtc_manager.has_signal("voice_chat_enabled_changed") and not webrtc_manager.voice_chat_enabled_changed.is_connected(_on_webrtc_enabled_changed):
			webrtc_manager.voice_chat_enabled_changed.connect(_on_webrtc_enabled_changed)
			print("VoiceChat: ✅ Deferred connection to voice_chat_enabled_changed signal")
		
		if webrtc_manager.has_signal("microphone_ready_changed") and not webrtc_manager.microphone_ready_changed.is_connected(_on_webrtc_microphone_ready_changed):
			webrtc_manager.microphone_ready_changed.connect(_on_webrtc_microphone_ready_changed)
			print("VoiceChat: ✅ Deferred connection to microphone_ready_changed signal")
		
		print("VoiceChat: ✅ Deferred room setup successful")
	else:
		print("VoiceChat: ❌ LiveKit manager still not ready after defer")

func set_main_net_client(client: Node) -> void:
	main_net_client = client
	if webrtc_manager:
		webrtc_manager.set_main_net_client(client)
	else:
		print("VoiceChat: ❌ No LiveKit manager for set_main_net_client - deferring...")
		call_deferred("_deferred_client_setup", client)

func _deferred_client_setup(client: Node) -> void:
	"""Deferred client setup for when LiveKit manager isn't ready immediately"""
	if webrtc_manager:
		print("VoiceChat: 🔄 Deferred client setup - delegating to LiveKitVoiceManager...")
		webrtc_manager.set_main_net_client(client)
		
		# Connect signals if they weren't connected before
		if webrtc_manager.has_signal("voice_chat_enabled_changed") and not webrtc_manager.voice_chat_enabled_changed.is_connected(_on_webrtc_enabled_changed):
			webrtc_manager.voice_chat_enabled_changed.connect(_on_webrtc_enabled_changed)
			print("VoiceChat: ✅ Deferred connection to voice_chat_enabled_changed signal")
		
		if webrtc_manager.has_signal("microphone_ready_changed") and not webrtc_manager.microphone_ready_changed.is_connected(_on_webrtc_microphone_ready_changed):
			webrtc_manager.microphone_ready_changed.connect(_on_webrtc_microphone_ready_changed)
			print("VoiceChat: ✅ Deferred connection to microphone_ready_changed signal")
	else:
		print("VoiceChat: ❌ LiveKit manager still not ready for client setup")

func update_local_player_position(position: Vector2) -> void:
	if webrtc_manager:
		webrtc_manager.update_local_player_position(position)

func update_player_position(session_id: String, position: Vector2) -> void:
	if webrtc_manager:
		webrtc_manager.update_player_position(session_id, position)

func calculate_proximity_volume(distance: float) -> float:
	if webrtc_manager:
		return webrtc_manager._calculate_proximity_volume(distance)
	
	# Fallback calculation
	if distance > proximity_range:
		return 0.0
	return 1.0 - (distance / proximity_range)

func on_voice_zone_changed() -> void:
	"""Handle voice zone changes (team room entry/exit) - delegate to WebRTC manager"""
	print("VoiceChat: Voice zone changed - delegating to WebRTC manager")
	if webrtc_manager and webrtc_manager.has_method("on_voice_zone_changed"):
		webrtc_manager.on_voice_zone_changed()
	else:
		print("VoiceChat: ❌ WebRTC manager not available for zone change")

func get_proximity_volume_for_player(_session_id: String) -> float:
	if webrtc_manager:
		# Use the WebRTC manager's position tracking
		return 1.0  # WebRTC handles this automatically
	return 1.0

func play_voice_data(audio_bytes: PackedByteArray, volume: float = 1.0) -> void:
	# WebRTC handles audio automatically, this is just for compatibility
	if webrtc_manager:
		webrtc_manager.play_voice_data(audio_bytes, volume)

func debug_voice_chat_state() -> Dictionary:
	print("VoiceChat: debug_voice_chat_state - webrtc_manager exists: ", webrtc_manager != null)
	if webrtc_manager:
		var debug_info = webrtc_manager.debug_voice_chat_state()
		debug_info["compatibility_wrapper"] = true
		return debug_info
	
	return {
		"voice_enabled": voice_enabled,
		"is_recording": is_recording,
		"has_room": room != null,
		"compatibility_wrapper": true,
		"webrtc_manager_null": true
	}

# Legacy function signatures that are no longer needed but kept for compatibility
func _on_voice_data_received(data) -> void:
	print("VoiceChat: Legacy _on_voice_data_received called, but WebRTC handles audio directly")
	# Emit compatibility signal if anything is listening
	var session_id = data.get("session_id", "")
	if session_id:
		voice_data_received.emit(session_id, PackedByteArray())

# All complex audio processing functions have been removed - WebRTC handles everything automatically!
