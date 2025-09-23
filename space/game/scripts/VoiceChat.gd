# res://scripts/VoiceChat.gd
# Compatibility wrapper for old VoiceChat - now delegates to WebRTCVoiceManager
extends Node

signal voice_data_received(session_id: String, audio_data: PackedByteArray)
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
	
	# Add to group so MicrophoneUI can find us
	add_to_group("voice_chat")
	
	# Find or create the WebRTC manager
	webrtc_manager = get_node_or_null("../WebRTCVoiceManager")
	if not webrtc_manager:
		# Create WebRTC manager if it doesn't exist
		var webrtc_script = load("res://scripts/WebRTCVoiceManager.gd")
		webrtc_manager = webrtc_script.new()
		webrtc_manager.name = "WebRTCVoiceManager"
		get_parent().call_deferred("add_child", webrtc_manager)
		print("VoiceChat: Created WebRTCVoiceManager")
	
	# Connect to WebRTC manager signals
	if webrtc_manager.has_signal("voice_chat_enabled_changed"):
		webrtc_manager.voice_chat_enabled_changed.connect(_on_webrtc_enabled_changed)
	
	# player_talking_changed signal connection removed
	
	print("VoiceChat: Compatibility wrapper ready - delegating to WebRTCVoiceManager")

func _on_webrtc_enabled_changed(enabled: bool) -> void:
	"""Update local state when WebRTC manager changes"""
	voice_enabled = enabled
	is_recording = enabled

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
	if webrtc_manager:
		webrtc_manager.set_voice_enabled(enabled)
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
		print("VoiceChat: 🎤 Delegating room to WebRTCVoiceManager...")
		webrtc_manager.set_room(colyseus_room)
		print("VoiceChat: 🎤 Room delegated successfully")
	else:
		print("VoiceChat: ❌ No WebRTC manager to delegate room to!")
	print("VoiceChat: Room set - delegated to WebRTCVoiceManager")

func set_main_net_client(client: Node) -> void:
	main_net_client = client
	if webrtc_manager:
		webrtc_manager.set_main_net_client(client)

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
	if webrtc_manager:
		return webrtc_manager.debug_voice_chat_state()
	
	return {
		"voice_enabled": voice_enabled,
		"is_recording": is_recording,
		"has_room": room != null,
		"compatibility_wrapper": true
	}

# Legacy function signatures that are no longer needed but kept for compatibility
func _on_voice_data_received(data) -> void:
	print("VoiceChat: Legacy _on_voice_data_received called, but WebRTC handles audio directly")
	# Emit compatibility signal if anything is listening
	var session_id = data.get("session_id", "")
	if session_id:
		voice_data_received.emit(session_id, PackedByteArray())

# All complex audio processing functions have been removed - WebRTC handles everything automatically!
