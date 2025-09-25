# res://scripts/VoiceChat.gd
# Voice Chat wrapper - delegates to LiveKitVoiceManager
extends Node

signal voice_data_received(session_id: String, audio_data: PackedByteArray)
signal microphone_ready_changed(is_ready: bool)

# Compatibility properties
var is_recording := false
var voice_enabled := false
var proximity_range := 300.0

# Reference to the LiveKit manager
var livekit_manager: Node = null
var room: Object = null
var main_net_client: Node = null

func _ready() -> void:
	print("VoiceChat: Starting LiveKit voice chat system...")
	
	# Add to group so UI can find us
	add_to_group("voice_chat")
	
	# Use LiveKit SFU voice manager
	print("VoiceChat: Looking for existing LiveKitVoiceManager...")
	livekit_manager = get_node_or_null("../LiveKitVoiceManager")
	print("VoiceChat: Existing manager found: ", livekit_manager != null)
	
	if not livekit_manager:
		# Create LiveKit voice manager
		print("VoiceChat: Creating LiveKitVoiceManager...")
		var voice_script = load("res://scripts/LiveKitVoiceManager.gd")
		if voice_script:
			print("VoiceChat: ✅ Script loaded successfully")
			livekit_manager = voice_script.new()
			if livekit_manager:
				print("VoiceChat: ✅ Instance created successfully")
				livekit_manager.name = "LiveKitVoiceManager"
				get_parent().call_deferred("add_child", livekit_manager)
				print("VoiceChat: ✅ Created LiveKitVoiceManager")
			else:
				print("VoiceChat: ❌ Failed to create instance from script")
		else:
			print("VoiceChat: ❌ Failed to load LiveKitVoiceManager script!")
	else:
		print("VoiceChat: ✅ Found existing LiveKitVoiceManager")
	
	# Connect to voice manager signals
	if livekit_manager:
		call_deferred("_connect_manager_signals")
	else:
		print("VoiceChat: ❌ No livekit_manager available for signal connections")
	
	print("VoiceChat: ✅ LiveKit voice chat system ready")

func _connect_manager_signals() -> void:
	"""Connect to voice manager signals"""
	print("VoiceChat: Connecting signals - manager exists: ", livekit_manager != null)
	if livekit_manager:
		if livekit_manager.has_signal("voice_chat_enabled_changed"):
			livekit_manager.voice_chat_enabled_changed.connect(_on_livekit_enabled_changed)
			print("VoiceChat: ✅ Connected to voice_chat_enabled_changed signal")
		
		if livekit_manager.has_signal("microphone_ready_changed"):
			livekit_manager.microphone_ready_changed.connect(_on_livekit_microphone_ready_changed)
			print("VoiceChat: ✅ Connected to microphone_ready_changed signal")

func _on_livekit_enabled_changed(enabled: bool) -> void:
	"""Update local state when LiveKit manager changes"""
	voice_enabled = enabled
	is_recording = enabled

func _on_livekit_microphone_ready_changed(is_ready: bool) -> void:
	"""Forward microphone ready signal from LiveKit manager to UI"""
	print("VoiceChat: 🎤 Microphone ready changed to: ", is_ready, " - forwarding to UI")
	microphone_ready_changed.emit(is_ready)

# Voice chat methods that delegate to LiveKit manager

func get_voice_enabled() -> bool:
	if livekit_manager:
		return livekit_manager.get_voice_enabled()
	return voice_enabled

func get_is_recording() -> bool:
	if livekit_manager:
		return livekit_manager.get_is_recording()
	return is_recording

func set_voice_enabled(enabled: bool) -> void:
	print("VoiceChat: set_voice_enabled called with: ", enabled)
	if livekit_manager:
		print("VoiceChat: Delegating to LiveKitVoiceManager...")
		livekit_manager.set_voice_enabled(enabled)
	else:
		print("VoiceChat: ❌ No livekit_manager available!")
	voice_enabled = enabled
	is_recording = enabled

func start_recording() -> void:
	if livekit_manager:
		livekit_manager.set_voice_enabled(true)

func stop_recording() -> void:
	if livekit_manager:
		livekit_manager.set_voice_enabled(false)

func start_microphone() -> void:
	if livekit_manager:
		livekit_manager.set_voice_enabled(true)

func stop_microphone() -> void:
	if livekit_manager:
		livekit_manager.set_voice_enabled(false)

func set_room(colyseus_room: Object, _register_handler: bool = true) -> void:
	print("VoiceChat: 🎤 set_room called")
	room = colyseus_room
	
	if livekit_manager:
		print("VoiceChat: 🎤 Delegating room to LiveKitVoiceManager...")
		livekit_manager.set_room(colyseus_room)
	else:
		print("VoiceChat: ❌ No LiveKit manager available! Deferring room setup...")
		call_deferred("_deferred_room_setup", colyseus_room)

func _deferred_room_setup(colyseus_room: Object) -> void:
	"""Deferred room setup for when LiveKit manager isn't ready immediately"""
	if livekit_manager:
		print("VoiceChat: 🔄 Deferred room setup - delegating to LiveKitVoiceManager...")
		livekit_manager.set_room(colyseus_room)
		_connect_manager_signals()
	else:
		print("VoiceChat: ❌ LiveKit manager still not ready after defer")

func set_main_net_client(client: Node) -> void:
	main_net_client = client
	if livekit_manager:
		livekit_manager.set_main_net_client(client)
	else:
		call_deferred("_deferred_client_setup", client)

func _deferred_client_setup(client: Node) -> void:
	"""Deferred client setup for when LiveKit manager isn't ready immediately"""
	if livekit_manager:
		livekit_manager.set_main_net_client(client)
		_connect_manager_signals()

func debug_voice_chat_state() -> Dictionary:
	print("VoiceChat: debug_voice_chat_state - livekit_manager exists: ", livekit_manager != null)
	if livekit_manager:
		var debug_info = livekit_manager.debug_voice_chat_state()
		debug_info["voice_system"] = "LiveKit"
		return debug_info
	
	return {
		"voice_enabled": voice_enabled,
		"is_recording": is_recording,
		"has_room": room != null,
		"voice_system": "LiveKit",
		"livekit_manager_null": true
	}

# Legacy compatibility functions (mostly no-ops since LiveKit handles everything)
func update_local_player_position(_position: Vector2) -> void:
	pass  # LiveKit doesn't need position updates

func update_player_position(_session_id: String, _position: Vector2) -> void:
	pass  # LiveKit doesn't need position updates

func calculate_proximity_volume(_distance: float) -> float:
	return 1.0  # LiveKit handles audio automatically

func on_voice_zone_changed() -> void:
	"""Handle voice zone changes - LiveKit handles rooms automatically"""
	pass

func get_proximity_volume_for_player(_session_id: String) -> float:
	return 1.0  # LiveKit handles this automatically

func play_voice_data(_audio_bytes: PackedByteArray, _volume: float = 1.0) -> void:
	pass  # LiveKit handles audio automatically

func _on_voice_data_received(data) -> void:
	# Emit compatibility signal if anything is listening
	var session_id = data.get("session_id", "")
	if session_id:
		voice_data_received.emit(session_id, PackedByteArray())

