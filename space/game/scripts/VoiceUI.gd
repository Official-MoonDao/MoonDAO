# res://scripts/VoiceUI.gd
extends Control

@onready var voice_status: Label = $VoiceStatus
@onready var voice_chat: Node = null
@onready var main_net_client: Node = get_node("..")

func _ready() -> void:
	# Create UI elements
	if voice_status == null:
		voice_status = Label.new()
		voice_status.name = "VoiceStatus"
		voice_status.text = "Voice: V to toggle"
		voice_status.position = Vector2(10, 10)
		voice_status.add_theme_color_override("font_color", Color.WHITE)
		add_child(voice_status)
	
	# Find VoiceChat node - try multiple paths
	print("VoiceUI: Searching for VoiceChat node...")
	
	# Try the original path first
	if get_node_or_null("../VoiceChat") != null:
		voice_chat = get_node("../VoiceChat")
		print("VoiceUI: Found VoiceChat at ../VoiceChat")
	# Try alternative paths
	elif get_node_or_null("../../VoiceChat") != null:
		voice_chat = get_node("../../VoiceChat")
		print("VoiceUI: Found VoiceChat at ../../VoiceChat")
	elif main_net_client and main_net_client.get_node_or_null("VoiceChat") != null:
		voice_chat = main_net_client.get_node("VoiceChat")
		print("VoiceUI: Found VoiceChat at MainNetClient/VoiceChat")
	else:
		print("VoiceUI: ❌ Could not find VoiceChat node in any expected location")
		print("VoiceUI: Available child nodes of parent: ", get_parent().get_children().map(func(n): return n.name))
		if main_net_client:
			print("VoiceUI: Available child nodes of MainNetClient: ", main_net_client.get_children().map(func(n): return n.name))
	
	# Connect to voice chat signals if available
	if voice_chat and voice_chat.has_signal("voice_data_received"):
		voice_chat.voice_data_received.connect(_on_voice_received)
		print("VoiceUI: ✅ Connected to voice_data_received signal")
	else:
		print("VoiceUI: ❌ Failed to connect to voice_data_received signal - voice_chat: ", voice_chat, " has_signal: ", voice_chat.has_signal("voice_data_received") if voice_chat else "N/A")

func _process(_delta: float) -> void:
	if voice_chat:
		if voice_chat.is_recording:
			voice_status.text = "🎤 Recording... (V to stop)"
			voice_status.add_theme_color_override("font_color", Color.GREEN)
		elif voice_chat.voice_enabled:
			voice_status.text = "🎤 Ready (V to talk)"
			voice_status.add_theme_color_override("font_color", Color.WHITE)
		else:
			voice_status.text = "🎤 Disabled"
			voice_status.add_theme_color_override("font_color", Color.GRAY)

func _on_voice_received(session_id: String, audio_data: PackedByteArray) -> void:
	print("VoiceUI: 🔥 VOICE RECEIVED! Session: ", session_id, " bytes: ", audio_data.size())
	
	# Calculate proximity-based volume
	var volume = calculate_proximity_volume(session_id)
	print("VoiceUI: 🔥 CALCULATED VOLUME: ", volume)
	
	# Play the received audio with proximity volume
	if voice_chat and audio_data.size() > 0:
		voice_chat.play_voice_data(audio_data, volume)
		print("VoiceUI: 🔥 PLAYING at volume: ", volume)
	else:
		print("VoiceUI: ❌ Cannot play audio - no voice_chat or no data")
	
	# Visual feedback when receiving voice (only if volume > 0)
	if volume > 0.1:  # Only show indicator if voice is audible
		voice_status.text = "🔊 " + voice_status.text
		# Reset after a short time
		await get_tree().create_timer(0.1).timeout
		if voice_status:
			voice_status.text = voice_status.text.replace("🔊 ", "")

func calculate_proximity_volume(session_id: String) -> float:
	"""Calculate volume based on distance between local player and speaking player"""
	if not main_net_client:
		print("VoiceUI: No main_net_client reference - returning 1.0")
		return 1.0
	
	# Get the speaking player's position
	if not main_net_client.players.has(session_id):
		print("VoiceUI: Player ", session_id, " not found in players dictionary")
		print("VoiceUI: Available players: ", main_net_client.players.keys())
		return 1.0
	
	var speaking_player = main_net_client.players[session_id]
	if not speaking_player:
		print("VoiceUI: Speaking player is null - returning 1.0")
		return 1.0
	
	# Get local player (the one being followed by camera)
	var local_player = main_net_client._follow
	if not local_player:
		print("VoiceUI: No local player to calculate distance from - returning 1.0")
		return 1.0
	
	# Calculate distance between players
	var distance = local_player.global_position.distance_to(speaking_player.global_position)
	
	# Simple proximity calculation directly here
	var proximity_range = 1000.0  # Maximum distance for voice chat
	var volume = 0.0
	
	if distance > proximity_range:
		volume = 0.0
	elif distance < 30.0:
		# Very close: full volume (0-30 pixels)
		volume = 1.0
	elif distance < 60.0:
		# Close: slight falloff (30-60 pixels)
		volume = 0.8 + (0.2 * (1.0 - (distance - 30.0) / 30.0))
	elif distance < 100.0:
		# Medium: noticeable falloff (60-100 pixels)
		var zone_progress = (distance - 60.0) / 40.0
		volume = 0.8 * (1.0 - (zone_progress * zone_progress))  # Quadratic falloff
	else:
		# Far: rapid falloff to silence (100-1000 pixels)
		var zone_progress = (distance - 100.0) / 900.0
		# Exponential falloff for realistic distance effect
		volume = 0.3 * pow(1.0 - zone_progress, 3.0)
	
	# Enhanced debug output for testing
	print("🔊 PROXIMITY: Distance from ", session_id, ": ", distance, " pixels → Volume: ", volume)
	print("🔊 Local player position: ", local_player.global_position)
	print("🔊 Speaking player position: ", speaking_player.global_position)
	
	if volume == 0.0:
		print("🔊 🔇 SILENT: Player too far away (distance > ", proximity_range, ")")
	elif volume < 0.1:
		print("🔊 🔉 QUIET: Low volume due to distance")
	elif volume < 0.5:
		print("🔊 🔉 MEDIUM: Moderate volume")
	else:
		print("🔊 🔊 LOUD: High volume (close proximity)")
	
	return volume
