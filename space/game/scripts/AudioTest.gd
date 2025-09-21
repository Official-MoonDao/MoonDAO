# Simple microphone test script
extends Node

func _ready():
	print("🎙️ Starting simple microphone test...")
	
	# Check if audio input is enabled
	var audio_input_enabled = ProjectSettings.get_setting("audio/driver/enable_input", false)
	print("Audio input enabled in settings: ", audio_input_enabled)
	
	# Try to create just an AudioStreamMicrophone without any fancy setup
	print("Creating AudioStreamMicrophone...")
	var mic_stream = AudioStreamMicrophone.new()
	print("AudioStreamMicrophone created successfully: ", mic_stream != null)
	
	# Try to create an AudioStreamPlayer
	print("Creating AudioStreamPlayer...")
	var player = AudioStreamPlayer.new()
	add_child(player)
	
	# Try to assign the microphone stream
	print("Assigning microphone stream to player...")
	player.stream = mic_stream
	
	# Try to start playing
	print("Attempting to start microphone...")
	player.play()
	
	# Check if it's actually playing
	await get_tree().process_frame
	print("Microphone playing: ", player.playing)
	
	if player.playing:
		print("✅ SUCCESS: Microphone is working!")
	else:
		print("❌ FAILED: Microphone failed to start")
		print("Player state: ", player.get_stream_playback())
