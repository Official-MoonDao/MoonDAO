extends Node2D
@export var speed := 140.0
@onready var view: Node2D = $Astronaut
@onready var name_label: Label = $Label
@onready var audio_player_2d: AudioStreamPlayer2D = $AudioStreamPlayer2D
var audio_player_fallback: AudioStreamPlayer  # Fallback for iframe

var is_local_player := false
var network_position := Vector2.ZERO
var last_input_time := 0.0
var session_id := ""

func _process(delta: float) -> void:
	if not is_local_player:
		# Non-local players: smooth interpolate to network position
		var old_pos = global_position
		var distance_to_target = global_position.distance_to(network_position)
		
		# Only interpolate if we're not already at the target
		if distance_to_target > 1.0:  # Small threshold to avoid micro-movements
			global_position = global_position.lerp(network_position, 8.0 * delta)
			
			# Calculate velocity from the interpolated movement for animations
			var velocity = (global_position - old_pos) / delta
			if view.has_method("update_from_velocity"):
				view.update_from_velocity(velocity)
		else:
			# We're close enough to the target, stop animating
			if view.has_method("update_from_velocity"):
				view.update_from_velocity(Vector2.ZERO)
		return
	
	# Local player: immediate input response with client-side prediction
	var v := Vector2(
		Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
		Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	) * speed * delta

	if v != Vector2.ZERO:
		position += v
		last_input_time = Time.get_time_dict_from_system().get("unix", 0.0)
	
	if view.has_method("update_from_velocity"):
		view.update_from_velocity(v / delta)  # convert back to velocity

func set_local_player(is_local: bool) -> void:
	is_local_player = is_local

func set_network_position(net_pos: Vector2) -> void:
	network_position = net_pos
	if not is_local_player:
		# For remote players, the position will be smoothly interpolated in _process()
		# and animations will be handled there too
		pass
	else:
		# For local player, only reconcile if we haven't had input recently
		# This prevents server corrections from fighting local movement
		if Time.get_time_dict_from_system().get("unix", 0.0) - last_input_time > 0.1:
			global_position = global_position.lerp(net_pos, 0.3)

func set_name_text(txt: String) -> void:
	if name_label == null:
		return
	name_label.text = txt if txt != null else ""

func set_session_id(sid: String) -> void:
	session_id = sid

func play_voice_frames(frames_data: Array) -> void:
	if is_local_player:
		return  # Don't play back our own voice
	
	print("Player: Playing voice frames directly, frame count: ", frames_data.size())
	
	# Convert Array to PackedVector2Array
	var frames = PackedVector2Array()
	frames.resize(frames_data.size())
	
	for i in range(frames_data.size()):
		var frame_data = frames_data[i]
		if frame_data is Dictionary:
			# Handle frame as dictionary with x, y
			frames[i] = Vector2(frame_data.get("x", 0.0), frame_data.get("y", 0.0))
		elif frame_data is Array and frame_data.size() >= 2:
			# Handle frame as array [x, y]
			frames[i] = Vector2(frame_data[0], frame_data[1])
		else:
			# Fallback - treat as mono audio
			var mono_val = float(frame_data) if frame_data is float else 0.0
			frames[i] = Vector2(mono_val, mono_val)
	
	# Choose the appropriate audio player
	var audio_player: Node
	if OS.has_feature("web"):
		if audio_player_fallback == null:
			audio_player_fallback = AudioStreamPlayer.new()
			add_child(audio_player_fallback)
			audio_player_fallback.volume_db = 0.0
			print("Player: Created fallback AudioStreamPlayer for web frames")
		audio_player = audio_player_fallback
	else:
		audio_player = audio_player_2d
	
	# Create or reuse AudioStreamGenerator
	if audio_player.stream == null or not audio_player.stream is AudioStreamGenerator:
		var stream = AudioStreamGenerator.new()
		stream.buffer_length = 0.5
		audio_player.stream = stream
		print("Player: Created new AudioStreamGenerator for frames")
	
	# Start playing if not already playing
	if not audio_player.playing:
		audio_player.play()
		print("Player: Started audio playback for frames")
	
	# Get the playback stream and push frames directly
	var playback = audio_player.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		var available_frames = playback.get_frames_available()
		if available_frames >= frames.size():
			playback.push_buffer(frames)
			print("Player: Successfully pushed ", frames.size(), " frames directly to playback")
		else:
			print("Player: Buffer full for frames, available: ", available_frames, " needed: ", frames.size())
	else:
		print("Player: Failed to get stream playback for frames")

func play_voice_audio(audio_bytes: PackedByteArray) -> void:
	if is_local_player:
		return  # Don't play back our own voice
	
	# Enhanced logging for debugging
	print("Player: Playing voice audio, bytes size: ", audio_bytes.size())
	if audio_bytes.size() > 0:
		var sample_bytes = audio_bytes.slice(0, min(8, audio_bytes.size()))
		print("Player: Sample data first 8 bytes: ", sample_bytes)
	
	# Limit buffer size to prevent crashes
	if audio_bytes.size() > 4096:  # Limit to 4KB
		print("Player: Audio buffer too large, truncating")
		audio_bytes = audio_bytes.slice(0, 4096)
	
	# Convert bytes back to audio frames
	var frames = bytes_to_audio_frames(audio_bytes)
	if frames.size() == 0:
		print("Player: No audio frames generated from bytes")
		return
	
	# Enhanced frame logging
	print("Player: Generated ", frames.size(), " audio frames")
	if frames.size() > 0:
		print("Player: Sample frame data: ", frames[0], " to ", frames[min(frames.size()-1, 4)])
	
	# For web platform, use JavaScript Web Audio API for better compatibility
	if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
		_play_audio_via_web_audio(frames, 1.0)
		return
	
	# Choose the appropriate audio player for native platforms
	var audio_player: Node = audio_player_2d
	
	# Create or reuse AudioStreamGenerator for real-time playback
	if audio_player.stream == null or not audio_player.stream is AudioStreamGenerator:
		var stream = AudioStreamGenerator.new()
		# Set properties that are available
		stream.buffer_length = 0.5  # Larger buffer to prevent underruns
		# Note: sample_rate might be read-only, using default
		audio_player.stream = stream
		print("Player: Created new AudioStreamGenerator for ", "web fallback" if OS.has_feature("web") else "2D audio")
		print("Player: AudioStreamGenerator sample rate: ", stream.sample_rate)
	
	# Start playing if not already playing
	if not audio_player.playing:
		audio_player.play()
		print("Player: Started audio playback on ", "AudioStreamPlayer (web)" if OS.has_feature("web") else "AudioStreamPlayer2D")
		
		# Check if we're in an iframe and audio is actually working
		if OS.has_feature("web"):
			print("Player: Web platform - audio player type: ", audio_player.get_class())
			if not audio_player.playing:
				print("Player: WARNING - Audio player failed to start in web context!")
			else:
				print("Player: SUCCESS - Audio player started in web context!")
		
		print("Player: Audio player volume: ", audio_player.volume_db)
		
		# Test audio context in web (only once per player)
		if OS.has_feature("web") and not has_meta("audio_tested"):
			# Try to play a simple beep to test if audio works
			_test_audio_context(audio_player)
			set_meta("audio_tested", true)
	
	# Get the playback stream and push frames
	var playback = audio_player.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		# Check available space before pushing
		var available_frames = playback.get_frames_available()
		if available_frames >= frames.size():
			playback.push_buffer(frames)
			print("Player: Successfully pushed ", frames.size(), " frames to playback")
		else:
			print("Player: Buffer full, available: ", available_frames, " needed: ", frames.size())
	else:
		print("Player: Failed to get stream playback")

func bytes_to_audio_frames(bytes: PackedByteArray) -> PackedVector2Array:
	var frames = PackedVector2Array()
	
	# Ensure we have valid data
	if bytes.size() == 0 or bytes.size() % 4 != 0:
		print("Player: Invalid audio data size: ", bytes.size())
		return frames
	
	var frame_count = bytes.size() / 4
	frames.resize(frame_count)
	
	for i in range(0, bytes.size() - 3, 4):  # Ensure we don't go out of bounds
		# Unpack little-endian 16-bit integers
		var left = int(bytes[i]) | (int(bytes[i + 1]) << 8)
		var right = int(bytes[i + 2]) | (int(bytes[i + 3]) << 8)
		
		# Convert signed 16-bit to signed
		if left > 32767:
			left -= 65536
		if right > 32767:
			right -= 65536
		
		# Convert to float (normalized between -1.0 and 1.0)
		var frame_index = i / 4
		frames[frame_index] = Vector2(left / 32767.0, right / 32767.0)
	
	return frames

func _play_audio_via_web_audio(frames: PackedVector2Array, volume: float) -> void:
	"""Play audio using JavaScript Web Audio API for web platforms"""
	
	# Convert frames to a format JavaScript can use
	var samples_array = []
	for frame in frames:
		samples_array.append(frame.x)  # Use left channel (mono)
	
	# Create JavaScript code to play audio
	var js_play_code = """
	(function() {
		// Ensure we have an audio context for playback
		if (!window.audioOutputContext) {
			window.audioOutputContext = new (window.AudioContext || window.webkitAudioContext)({
				sampleRate: 22050
			});
			console.log('Player: Created audio output context for voice playback');
		}
		
		var audioContext = window.audioOutputContext;
		var samples = %s;
		var volume = %f;
		
		// Resume context if suspended (required by browsers)
		if (audioContext.state === 'suspended') {
			audioContext.resume().then(() => {
				console.log('Player: Audio context resumed for playback');
			});
		}
		
		// Create buffer for the audio data
		var buffer = audioContext.createBuffer(1, samples.length, 22050);
		var channelData = buffer.getChannelData(0);
		
		// Copy samples to buffer
		for (var i = 0; i < samples.length; i++) {
			channelData[i] = samples[i] * volume;
		}
		
		// Create buffer source and connect to output
		var source = audioContext.createBufferSource();
		source.buffer = buffer;
		
		// Apply volume
		var gainNode = audioContext.createGain();
		gainNode.gain.value = volume;
		
		// Connect: source -> gain -> speakers
		source.connect(gainNode);
		gainNode.connect(audioContext.destination);
		
		// Play the audio
		source.start();
		
		console.log('Player: Playing voice audio via Web Audio API, samples:', samples.length, 'volume:', volume);
	})();
	""" % [var_to_str(samples_array), volume]
	
	JavaScriptBridge.eval(js_play_code)
	print("Player: Playing ", frames.size(), " frames via Web Audio API at volume ", volume)

func _test_audio_context(audio_player: Node) -> void:
	print("Player: Testing audio context...")
	
	# Generate a simple test tone
	var test_frames = PackedVector2Array()
	test_frames.resize(100)  # Small test
	for i in range(100):
		var tone = sin(i * 0.1) * 0.1  # Quiet test tone
		test_frames[i] = Vector2(tone, tone)
	
	var playback = audio_player.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		playback.push_buffer(test_frames)
		print("Player: Test tone pushed to audio buffer")
	else:
		print("Player: FAILED to get playback for test tone")
