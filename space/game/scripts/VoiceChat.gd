# res://scripts/VoiceChat.gd
extends Node

signal voice_data_received(session_id: String, audio_data: PackedByteArray)

# Audio configuration constants
const SAMPLE_RATE = 44100

var is_recording := false
var voice_enabled := false  # Start disabled, UI will control this
var proximity_range := 1000.0  # Maximum distance for voice chat (temporarily increased for testing)
var audio_effect_capture: AudioEffectCapture
var audio_stream_player: AudioStreamPlayer
var microphone_player: AudioStreamPlayer  # For microphone input
var room: Object = null  # Reference to Colyseus room
var web_audio_setup_done := false  # Track if web audio has been set up
var record_bus_index: int  # Index of the audio bus for recording

# Audio transmission management
var last_voice_send_time := 0.0
var adaptive_interval := 0.03  # Start at 30ms, adjust based on audio amount

# Audio settings
const BUFFER_SIZE = 256  # Smaller buffer to prevent overflow

func _ready() -> void:
	print("VoiceChat: ==================== VOICECHAT STARTING ====================")
	print("VoiceChat: Platform: ", OS.get_name())
	print("VoiceChat: Web platform: ", OS.has_feature("web"))
	
	# Add to group so MicrophoneUI can find us
	add_to_group("voice_chat")
	print("VoiceChat: Added to 'voice_chat' group for easy discovery")
	print("VoiceChat: Node path: ", get_path())
	print("VoiceChat: Node name: ", name)
	var parent_node = get_parent()
	print("VoiceChat: Parent: ", parent_node.name if parent_node != null else "No parent")
	print("VoiceChat: Initial state - voice_enabled: ", voice_enabled, " is_recording: ", is_recording)
	
	# Set up audio bus for recording (but don't auto-start microphone)
	if AudioServer.get_bus_index("Record") == -1:
		AudioServer.add_bus(1)
		AudioServer.set_bus_name(1, "Record")
		record_bus_index = AudioServer.get_bus_index("Record")
		print("VoiceChat: Created Record bus at index: ", record_bus_index)
	else:
		record_bus_index = AudioServer.get_bus_index("Record")
		print("VoiceChat: Record bus already exists at index: ", record_bus_index)
	
	# IMPORTANT: Don't start microphone automatically - wait for UI control
	print("VoiceChat: ✅ VoiceChat ready - microphone disabled by default")
	print("VoiceChat: 🎤 Click the microphone button to enable voice chat")
	print("VoiceChat: Final state - voice_enabled: ", voice_enabled, " is_recording: ", is_recording)

	print("VoiceChat: _request_browser_microphone_permission called")
	if not OS.has_feature("web"):
		print("VoiceChat: Not on web platform, skipping permission request")
		return
		
	print("VoiceChat: On web platform, requesting browser microphone permission via JavaScript...")
	
	# Set up basic JavaScript audio infrastructure (using good settings)
	var js_setup = """
(async function() {
	try {
		console.log('Setting up web audio infrastructure...');
		
		// Check if already set up
		if (window.webAudioData && window.webAudioData.isSetup) {
			console.log('Web audio already set up, skipping...');
			return true;
		}
		
		// Check if getUserMedia is available
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			console.error('getUserMedia not supported');
			return false;
		}
		
		// Request microphone access with GOOD settings
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				channelCount: 1,
				sampleRate: 44100  // Use standard sample rate
			},
			video: false
		});
		
		console.log('Microphone access granted!');
		console.log('Audio tracks:', stream.getAudioTracks().length);
		
		// Create audio context with standard sample rate
		const audioContext = new (window.AudioContext || window.webkitAudioContext)({
			sampleRate: 44100
		});
		
		// Create audio source from stream
		const source = audioContext.createMediaStreamSource(stream);
		
		// Create script processor with reliable buffer for stable capture  
		const scriptProcessor = audioContext.createScriptProcessor(512, 1, 1);
		
		// Set up audio data capture
		window.webAudioData = {
			isCapturing: false,
			audioBuffer: [],
			maxBufferSize: 6615,  // 0.15s buffer - balanced for fast speech and stability
			isSetup: true,
			stream: stream,
			audioContext: audioContext,
			scriptProcessor: scriptProcessor
		};
		
		scriptProcessor.onaudioprocess = function(event) {
			if (!window.webAudioData.isCapturing) return;
			
			const inputBuffer = event.inputBuffer;
			const channelData = inputBuffer.getChannelData(0);
			
			// Moderate volume reduction - clean but audible
			const inputVolume = 0.4;  // 40% of original volume - good balance
			
			// Convert to array for Godot with reduced volume and debug info
			let maxInput = 0;
			let maxOutput = 0;
			for (let i = 0; i < channelData.length; i++) {
				let originalSample = channelData[i];
				let sample = originalSample * inputVolume;
				
				// Track levels for debugging
				if (Math.abs(originalSample) > maxInput) maxInput = Math.abs(originalSample);
				if (Math.abs(sample) > maxOutput) maxOutput = Math.abs(sample);
				
				window.webAudioData.audioBuffer.push(sample);
			}
			
			// Debug audio levels occasionally
			if (Math.random() < 0.01 && maxInput > 0.01) {
				console.log('Audio levels: Input peak=' + maxInput.toFixed(3) + ', Output peak=' + maxOutput.toFixed(3) + ', Reduction=' + inputVolume);
			}
			
			// Prevent buffer overflow while maintaining fast speech capture
			if (window.webAudioData.audioBuffer.length > window.webAudioData.maxBufferSize) {
				window.webAudioData.audioBuffer = window.webAudioData.audioBuffer.slice(-4410); // Keep 0.1s for stable capture
			}
		};
		
		// Connect the audio graph
		source.connect(scriptProcessor);
		scriptProcessor.connect(audioContext.destination);
		
		console.log('Web Audio infrastructure setup complete!');
		return true;
	} catch (error) {
		console.error('Error setting up web audio:', error);
		return false;
	}
})();
"""
	
	if Engine.has_singleton("JavaScriptBridge"):
		JavaScriptBridge.eval(js_setup)
		print("VoiceChat: Web audio infrastructure setup initiated")
	else:
		print("VoiceChat: JavaScriptBridge not available")

func _get_web_audio_data_binary() -> PackedVector2Array:
	"""Efficient binary audio data retrieval - no string conversion!"""
	var frames = PackedVector2Array()
	
	if not Engine.has_singleton("JavaScriptBridge"):
		return frames
	
	# Numbers work! Let's get all audio using batch transfer
	# First, prepare the audio and get the count
	var js_prepare = """
	(function() {
		if (!window.webAudioData || !window.webAudioData.audioBuffer) {
			window.currentAudio = [];
			return 0;
		}
		var buffer = window.webAudioData.audioBuffer;
		if (buffer.length === 0) {
			window.currentAudio = [];
			return 0;
		}
		// Store samples and clear buffer
		window.currentAudio = buffer.slice();
		window.webAudioData.audioBuffer = [];
		console.log('JavaScript: Prepared', window.currentAudio.length, 'samples for batch transfer');
		return window.currentAudio.length;
	})();
	"""
	
	var sample_count = JavaScriptBridge.eval(js_prepare)
	if sample_count != null and typeof(sample_count) == TYPE_FLOAT and sample_count > 0:
		var length = int(sample_count)
		print("VoiceChat: 🔍 Got ", length, " samples, transferring in batches...")
		
		frames.resize(length)
		var batch_size = 100  # Transfer 100 samples at a time
		var total_retrieved = 0
		
		# Transfer in batches to balance speed vs call overhead
		for batch_start in range(0, length, batch_size):
			var batch_end = min(batch_start + batch_size, length)
			var batch_js = "window.currentAudio.slice(" + str(batch_start) + ", " + str(batch_end) + ")"
			var batch_result = JavaScriptBridge.eval(batch_js)
			
			# Even though we can't get arrays directly, maybe slice returns something useful
			if batch_result != null:
				print("VoiceChat: 🔍 Batch ", batch_start, "-", batch_end, " type:", typeof(batch_result))
				if typeof(batch_result) == TYPE_ARRAY:
					# Miracle! Arrays work when sliced
					for i in range(batch_result.size()):
						if batch_start + i < frames.size():
							var sample = float(batch_result[i])
							frames[batch_start + i] = Vector2(sample, sample)
							total_retrieved += 1
				else:
					# Fall back to individual sample calls for this batch
					for i in range(batch_start, batch_end):
						var sample_js = "window.currentAudio[" + str(i) + "] || 0.0"
						var sample_result = JavaScriptBridge.eval(sample_js)
						if sample_result != null and typeof(sample_result) == TYPE_FLOAT:
							frames[i] = Vector2(float(sample_result), float(sample_result))
							total_retrieved += 1
						else:
							frames[i] = Vector2(0.0, 0.0)
		
		print("VoiceChat: 🔍 ✅ Batch transfer complete: ", total_retrieved, "/", length, " samples retrieved")
	else:
		print("VoiceChat: 🔍 ❌ No samples available")
	
	return frames

func _get_web_audio_data_fixed() -> PackedVector2Array:
	"""Retrieve audio data from JavaScript as bytes and convert to frames"""
	var frames = PackedVector2Array()
	
	if not Engine.has_singleton("JavaScriptBridge"):
		return frames
	
	# Get audio data from JavaScript as direct floats to test for conversion artifacts
	var js_get_audio = """
	(function() {
		if (!window.webAudioData || !window.webAudioData.audioBuffer) {
			return "";
		}
		
		// Get all available audio data
		var buffer = window.webAudioData.audioBuffer;
		if (buffer.length === 0) {
			return "";
		}
		
		// Copy the buffer and clear it
		var audioData = buffer.slice();
		window.webAudioData.audioBuffer = [];
		
		// Return as direct float string (no conversion artifacts)
		var floatString = audioData.join(',');
		
		console.log('JavaScript: Retrieved', audioData.length, 'float samples, string length:', floatString.length);
		
		return floatString;
	})();
	"""
	
	var js_result = JavaScriptBridge.eval(js_get_audio)
	
	print("VoiceChat: 🔍 JS result type: ", typeof(js_result), " size: ", js_result.size() if js_result != null else "null")
	
	if js_result != null and js_result is String and js_result.length() > 0:
		# Parse comma-separated float string into audio frames (no conversion artifacts)
		var float_strings = js_result.split(",")
		if float_strings.size() > 0:
			frames.resize(float_strings.size())
			
			for i in range(float_strings.size()):
				# Direct float conversion - no byte encoding/decoding artifacts
				var sample_float = float(float_strings[i])
				frames[i] = Vector2(sample_float, sample_float)  # Convert mono to stereo
			
			print("VoiceChat: 🔍 ✅ Converted ", frames.size(), " samples from direct floats (", js_result.length(), " chars)")
		else:
			print("VoiceChat: 🔍 ❌ Float parsing failed - no samples: ", float_strings.size())
	else:
		print("VoiceChat: 🔍 ❌ No valid JavaScript audio data received")
	
	return frames

func _get_web_audio_simple_fallback() -> PackedVector2Array:
	"""Simple fallback audio retrieval"""
	var frames = PackedVector2Array()
	
	if not Engine.has_singleton("JavaScriptBridge"):
		return frames
	
	var js_simple = """
	(function() {
		if (window.webAudioData && window.webAudioData.audioBuffer && window.webAudioData.audioBuffer.length > 0) {
			var buffer = window.webAudioData.audioBuffer.splice(0, Math.min(256, window.webAudioData.audioBuffer.length));
			console.log('Fallback: Retrieved', buffer.length, 'samples');
			return buffer;
		}
		return [];
	})();
	"""
	
	var result = JavaScriptBridge.eval(js_simple)
	
	if result != null and result is Array and result.size() > 0:
		frames.resize(result.size())
		for i in range(result.size()):
			var sample = float(result[i])
			frames[i] = Vector2(sample, sample)  # Convert mono to stereo
		print("VoiceChat: 🔍 Fallback retrieved ", frames.size(), " frames")
	
	return frames

func get_voice_enabled() -> bool:
	"""Get current voice enabled state"""
	return voice_enabled

func get_is_recording() -> bool:
	"""Get current recording state"""
	return is_recording

func debug_voice_chat_state() -> Dictionary:
	"""Debug function to return all voice chat state"""
	return {
		"voice_enabled": voice_enabled,
		"is_recording": is_recording,
		"node_path": get_path(),
		"node_name": name,
		"has_room": room != null,
		"os_web": OS.has_feature("web")
	}

func start_recording() -> void:
	if not voice_enabled:
		print("VoiceChat: Voice not enabled - cannot start recording")
		return
		
	is_recording = true
	print("VoiceChat: Started recording")
	
	# Start JavaScript audio capture for web
	if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
		var js_start_code = """
		(function() {
			console.log('🎤 start_recording() called - attempting to start capture...');
			if (window.webAudioData) {
				console.log('🎤 start_recording - Before: isCapturing =', window.webAudioData.isCapturing);
				window.webAudioData.isCapturing = true;
				console.log('🎤 start_recording - After: isCapturing =', window.webAudioData.isCapturing);
				console.log('Started web audio capture');
			} else {
				console.log('❌ start_recording - No webAudioData found');
			}
		})();
		"""
		JavaScriptBridge.eval(js_start_code)
	elif audio_effect_capture:
		audio_effect_capture.clear_buffer()
		print("VoiceChat: Cleared native audio buffer")

func stop_recording() -> void:
	is_recording = false
	print("VoiceChat: Stopped recording")
	
	# Stop JavaScript audio capture for web
	if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
		JavaScriptBridge.eval("if (window.webAudioData) { window.webAudioData.isCapturing = false; console.log('Stopped web audio capture'); }")

func start_microphone() -> void:
	"""Start the microphone system and begin recording immediately"""
	if not voice_enabled:
		print("VoiceChat: Cannot start microphone - voice not enabled")
		return
		
	print("VoiceChat: Starting microphone system and recording...")
	
	# For web, setup the JavaScript audio system first (if not already done), then start capturing
	if OS.has_feature("web"):
		print("VoiceChat: Setting up and starting web microphone...")
		
		# Reset the setup flag in case we previously stopped and disconnected everything
		web_audio_setup_done = false
		print("VoiceChat: Reset web_audio_setup_done flag for fresh setup")
		
		# Call the setup function that was skipped in _ready()
		_setup_web_microphone()
		# After setup, start capturing immediately
		await get_tree().process_frame  # Wait for setup to complete
		if Engine.has_singleton("JavaScriptBridge"):
			var js_start_mic_code = """
			(function() {
				console.log('🎤 start_microphone() called - attempting to start capture...');
				if (window.webAudioData) {
					console.log('🎤 start_microphone - Before: isCapturing =', window.webAudioData.isCapturing);
					window.webAudioData.isCapturing = true;
					console.log('🎤 start_microphone - After: isCapturing =', window.webAudioData.isCapturing);
					console.log('Microphone started and capturing');
				} else {
					console.log('❌ start_microphone - No webAudioData found');
				}
			})();
			"""
			JavaScriptBridge.eval(js_start_mic_code)
	
	# Start recording immediately when microphone is enabled
	if not is_recording:
		is_recording = true
		print("VoiceChat: Auto-started recording (always-on mode)")

func stop_microphone() -> void:
	"""Stop the microphone system entirely"""
	print("VoiceChat: Stopping microphone system...")
	
	# Force stop recording
	is_recording = false
	print("VoiceChat: Forced is_recording to false")
	
	# Reset web audio setup flag so it can be re-initialized when restarted
	web_audio_setup_done = false
	print("VoiceChat: Reset web_audio_setup_done flag for future restart")
	
	# For web, stop the JavaScript audio system completely
	if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
		var js_stop_code = """
		(function() {
			console.log('Stopping web audio capture completely...');
			if (window.webAudioData) {
				// Stop capturing
				window.webAudioData.isCapturing = false;
				
				// Stop the microphone stream if it exists
				if (window.webAudioData.stream) {
					window.webAudioData.stream.getTracks().forEach(track => {
						track.stop();
						console.log('Stopped microphone track:', track.kind);
					});
				}
				
				// Disconnect audio processing
				if (window.webAudioData.scriptProcessor) {
					window.webAudioData.scriptProcessor.disconnect();
					console.log('Disconnected script processor');
				}
				
				if (window.webAudioData.source) {
					window.webAudioData.source.disconnect();
					console.log('Disconnected audio source');
				}
				
				// Clear the audio buffer
				window.webAudioData.audioBuffer = [];
				
				// Reset the setup flag so it can be re-initialized
				window.webAudioData.setupComplete = false;
				
				console.log('✅ Web audio completely stopped and cleaned up');
			} else {
				console.log('No webAudioData found to stop');
			}
		})();
		"""
		JavaScriptBridge.eval(js_stop_code)
	
	# Also clear any native audio buffers
	if audio_effect_capture:
		audio_effect_capture.clear_buffer()
		print("VoiceChat: Cleared native audio buffer")

func setup_audio_capture() -> void:
	# Create AudioStreamPlayer for playback
	audio_stream_player = AudioStreamPlayer.new()
	add_child(audio_stream_player)
	
	# Handle macOS Core Audio errors
	if OS.get_name() == "macOS" or OS.has_feature("web"):
		print("VoiceChat: Detected macOS/Web - applying Core Audio fixes")
		_handle_core_audio_setup()
	
	# Request microphone permission
	if OS.has_feature("web"):
		print("VoiceChat: Web platform detected, microphone permission required")
	
func set_room(colyseus_room: Object, register_handler: bool = true) -> void:
	room = colyseus_room
	if room != null:
		if register_handler:
			room.on_message("voice_data").on(Callable(self, "_on_voice_data_received"))
			print("VoiceChat: Connected to room for voice chat with message handler")
		else:
			print("VoiceChat: Connected to room for voice chat (message handled by MainNetClient)")

# Old functions removed - using new web audio compatible versions below

func _process(_delta: float) -> void:
	# Only process audio if voice is enabled
	if not voice_enabled:
		return
	
	# Only process if we're recording
	if not is_recording:
		return
	
	# Only process if we have a room to send to
	if not room:
		return
	
	# Occasionally log that we're actively processing
	if randf() < 0.01:  # 1% chance to log
		print("VoiceChat: ✅ Processing audio - voice enabled and recording")
		# Also log room state for debugging
		if room:
			print("VoiceChat: 🌐 Room connected: ", room.has_joined())
			print("VoiceChat: 🌐 Room ID: ", room.room_id if room.has_method("room_id") else "unknown")
			# Check how many players are in the room
			var state = room.get_state() if room.has_method("get_state") else null
			if state and state.has_method("get") and state.get("players"):
				var players = state.get("players")
				print("VoiceChat: 🌐 Players in room: ", players.size() if players.has_method("size") else "unknown")
				# List all player session IDs for debugging
				if players.has_method("keys"):
					var player_ids = players.keys()
					print("VoiceChat: 🌐 Player session IDs: ", player_ids)
			else:
				print("VoiceChat: 🌐 Player count: unknown (no state access)")
		else:
			print("VoiceChat: ❌ No room connected for voice data transmission")
	
	var audio_data = PackedVector2Array()
	
	# Use different audio capture method for web vs native
	if OS.has_feature("web"):
		# Always capture audio to prevent buffer overflow
		var new_audio_data = _get_web_audio_data_fixed()
		
		# Add new audio to buffer for continuous capture
		if new_audio_data.size() > 0:
			audio_buffer.append_array(new_audio_data)
			
			# Prevent buffer from growing too large (keep max 3 seconds of audio - responsive for speech)
			var max_buffer_size = SAMPLE_RATE * 3  # 3 seconds
			if audio_buffer.size() > max_buffer_size:
				# Remove oldest audio gently to prevent losing speech
				var target_size = int(max_buffer_size * 0.85)  # Keep 85% when trimming
				var excess = audio_buffer.size() - target_size
				var new_buffer = PackedVector2Array()
				for i in range(excess, audio_buffer.size()):
					new_buffer.append(audio_buffer[i])
				audio_buffer = new_buffer
				print("VoiceChat: ⚠️ Buffer overflow - gently removed ", excess, " old samples, keeping ", audio_buffer.size())
			
		# Debug audio capture more frequently to catch missing words
		if randf() < 0.02:  # 2% chance to log for debugging word loss
			print("VoiceChat: 🎙️ 60fps Capture - new: ", new_audio_data.size(), " buffered: ", audio_buffer.size())
			if new_audio_data.size() > 0:
				# Check for actual audio content
				var max_amplitude = 0.0
				for frame in new_audio_data:
					max_amplitude = max(max_amplitude, abs(frame.x))
				print("VoiceChat: 🔊 Audio amplitude: ", max_amplitude)
		
		# Process buffered audio for transmission - high frequency but stable
		var current_time = Time.get_ticks_msec() / 1000.0
		var transmission_interval = 0.015  # 67fps transmission rate - fast but stable
		var buffer_threshold = int(SAMPLE_RATE * transmission_interval)  # Exact samples for interval (661)
		
		# Send if timer elapsed AND we have enough audio for smooth fast speech
		var min_buffer_for_fast_speech = int(SAMPLE_RATE * 0.005)  # 5ms minimum buffer (220 samples)
		if audio_buffer.size() >= min_buffer_for_fast_speech and ((current_time - last_transmission_time) >= transmission_interval or audio_buffer.size() >= buffer_threshold):
			# Take samples from buffer for transmission - no overlap, stable frequency
			var chunk_size = int(SAMPLE_RATE * transmission_interval)  # Exact samples for interval (661)
			var transmission_size = min(audio_buffer.size(), chunk_size)  # Send exact chunk
			
			var audio_to_send = PackedVector2Array()
			for i in range(transmission_size):
				audio_to_send.append(audio_buffer[i])
			
			# Remove sent audio cleanly (no overlap)
			var remaining_buffer = PackedVector2Array()
			for i in range(transmission_size, audio_buffer.size()):
				remaining_buffer.append(audio_buffer[i])
			audio_buffer = remaining_buffer
			
			var trigger_reason = "timer" if (current_time - last_transmission_time) >= transmission_interval else "buffer_full"
			if audio_buffer.size() < min_buffer_for_fast_speech:
				print("VoiceChat: ⚠️ FAST SPEECH WARNING: Low buffer ", audio_buffer.size(), "/", min_buffer_for_fast_speech, " - may cause cutoff")
			print("VoiceChat: 📤 STABLE-FAST SEND: ", audio_to_send.size(), " samples (15ms chunks), remaining:", audio_buffer.size())
			
			# Send the audio
			_send_audio_data(audio_to_send)
			last_transmission_time = current_time
			
		return
	elif audio_effect_capture:
		# Use native AudioEffectCapture
		var frames_available = audio_effect_capture.get_frames_available()
		
		# Debug frames availability occasionally
		if randf() < 0.05:  # 5% chance to log
			print("VoiceChat: frames_available: ", frames_available, " platform: ", OS.get_name(), " web: ", OS.has_feature("web"))
		
		if frames_available > 0:
			audio_data = audio_effect_capture.get_buffer(min(frames_available, BUFFER_SIZE))
		
		if audio_data.size() > 0:
			# Enhanced debugging of audio data
			var max_amplitude = 0.0
			var has_sound = false
			var sample_frames = []
			
			for i in range(min(audio_data.size(), 5)):  # Check first 5 frames
				var frame = audio_data[i]
				sample_frames.append({"x": frame.x, "y": frame.y})
				var amplitude = max(abs(frame.x), abs(frame.y))
				if amplitude > max_amplitude:
					max_amplitude = amplitude
				if amplitude > 0.01:  # Threshold for detecting sound
					has_sound = true
				
			print("VoiceChat: Captured ", audio_data.size(), " frames, max_amplitude: ", max_amplitude, " has_sound: ", has_sound)
			print("VoiceChat: Sample frames: ", sample_frames)
			var mic_status = "null" if microphone_player == null else str(microphone_player.playing)
			print("VoiceChat: Microphone player still playing: ", mic_status)
			print("VoiceChat: AudioEffectCapture bus: ", AudioServer.get_bus_index("Record"))
			
			if has_sound:
				print("VoiceChat: AUDIO DETECTED - capturing frames with sound")
			else:
				print("VoiceChat: ⚠️  SILENT FRAMES - microphone not capturing audio")
				# Additional debugging for silent frames
				if microphone_player:
					print("VoiceChat: Silent frames debug - stream: ", microphone_player.stream != null)
					print("VoiceChat: Silent frames debug - bus: ", microphone_player.bus)
					print("VoiceChat: Silent frames debug - volume: ", microphone_player.volume_db)
			# Native platforms - convert to bytes
			var byte_data = audio_frames_to_bytes(audio_data)
			
			# Limit byte data size to prevent network buffer overflow
			if byte_data.size() > 2048:  # Limit to 2KB
				byte_data = byte_data.slice(0, 2048)
			
			print("VoiceChat: Native - sending ", byte_data.size(), " bytes (", audio_data.size(), " frames)")
			room.send("voice_data", {
				"data": byte_data,
				"sample_rate": SAMPLE_RATE,
				"format": "bytes"
			})
		else:
			print("VoiceChat: No audio data in buffer")
		# Note: No else for frames_available check - we just skip if no frames

func audio_frames_to_bytes(frames: PackedVector2Array) -> PackedByteArray:
	var bytes = PackedByteArray()
	bytes.resize(frames.size() * 4)  # 2 channels * 2 bytes per sample
	
	for i in range(frames.size()):
		var frame = frames[i]
		
		# Gentle conversion with dithering to reduce quantization noise
		var left_float = clamp(frame.x, -0.95, 0.95)  # Leave headroom to prevent clipping
		var right_float = clamp(frame.y, -0.95, 0.95)
		
		# Convert to 16-bit with clean conversion for 40% volume audio
		var left = int(round(left_float * 30000))  # Good range for 40% volume input
		var right = int(round(right_float * 30000))
		
		# Pack as little-endian 16-bit integers
		bytes[i * 4] = left & 0xFF
		bytes[i * 4 + 1] = (left >> 8) & 0xFF
		bytes[i * 4 + 2] = right & 0xFF
		bytes[i * 4 + 3] = (right >> 8) & 0xFF
	
	return bytes

func bytes_to_audio_frames(bytes: PackedByteArray) -> PackedVector2Array:
	var frames = PackedVector2Array()
	var frame_count = int(bytes.size() / 4)
	frames.resize(frame_count)
	
	for i in range(0, bytes.size(), 4):
		if i + 3 < bytes.size():
			# Unpack little-endian 16-bit integers
			var left = int(bytes[i]) | (int(bytes[i + 1]) << 8)
			var right = int(bytes[i + 2]) | (int(bytes[i + 3]) << 8)
			
			# Convert signed 16-bit to signed
			if left > 32767:
				left -= 65536
			if right > 32767:
				right -= 65536
			
			# Convert to float with matching conversion range  
			var frame_index = int(i / 4)
			frames[frame_index] = Vector2(left / 30000.0, right / 30000.0)
	
	return frames

func _test_microphone_access() -> void:
	print("VoiceChat: Testing microphone access...")
	
	# Detect if we're in an iframe
	if OS.has_feature("web"):
		print("VoiceChat: Running in web browser")
		print("VoiceChat: ⚠️  LOCALHOST DETECTED - Special microphone handling needed!")
		print("VoiceChat: 🔧 Localhost microphone access requires:")
		print("VoiceChat: 1. Manual browser permission via settings")
		print("VoiceChat: 2. Or use https://localhost (if SSL available)")
		print("VoiceChat: 3. Or use ngrok/tunneling for HTTPS")
		print("VoiceChat: 🔗 Or ensure iframe has 'allow=\"microphone\"' attribute")
	
	if microphone_player == null:
		print("VoiceChat: ERROR - microphone_player is null!")
		return
		
	if audio_effect_capture == null:
		print("VoiceChat: ERROR - audio_effect_capture is null!")
		return
	
	# Check microphone status (different for web vs native)
	if OS.has_feature("web"):
		print("VoiceChat: Web platform - using JavaScript audio capture (microphone_player not used)")
		print("VoiceChat: ✅ JavaScript audio capture should be active")
	else:
		# Native platform - check if microphone is actually playing
		if not microphone_player.playing:
			print("VoiceChat: WARNING - microphone_player is not playing!")
			print("VoiceChat: This likely means microphone access was denied")
			# Try to start it
			microphone_player.play()
			if microphone_player.playing:
				print("VoiceChat: ✅ Successfully started microphone_player")
			else:
				print("VoiceChat: ❌ FAILED to start microphone_player")
		else:
			print("VoiceChat: ✅ microphone_player is playing correctly")
	
	# Test audio capture (different methods for web vs native)
	if OS.has_feature("web"):
		print("VoiceChat: Testing JavaScript audio capture...")
		# For web, we'll test when recording actually starts
		print("VoiceChat: ✅ JavaScript audio test will occur during actual recording")
	else:
		# Test AudioEffectCapture for native platforms
		var available_frames = audio_effect_capture.get_frames_available()
		print("VoiceChat: Available frames in capture: ", available_frames)
		
		if available_frames > 0:
			var test_buffer = audio_effect_capture.get_buffer(min(10, available_frames))
			print("VoiceChat: ✅ Successfully captured ", test_buffer.size(), " test frames")
		else:
			print("VoiceChat: ❌ No frames available - microphone blocked or silent")

func _show_iframe_warning() -> void:
	print("🚨 IFRAME MICROPHONE BLOCKED!")
	print("┌─────────────────────────────────────────────────────────┐")
	print("│  Voice chat requires microphone access                 │")
	print("│  iframes often block microphone access                 │")
	print("│                                                         │")
	print("│  SOLUTIONS:                                             │")
	print("│  1. Open game in direct browser tab (not iframe)       │")
	print("│  2. Add allow='microphone' to iframe tag               │")
	print("│  3. Test on localhost or HTTPS domain                  │")
	print("│                                                         │")
	print("│  For testing: Copy the game URL and open directly      │")
	print("└─────────────────────────────────────────────────────────┘")

func _test_immediate_capture() -> void:
	print("VoiceChat: Testing immediate capture after recording start...")
	
	if not audio_effect_capture:
		print("VoiceChat: No audio_effect_capture for immediate test")
		return
	
	var frames = audio_effect_capture.get_frames_available()
	print("VoiceChat: Immediate frames available: ", frames)
	
	# Wait a bit and test again
	await get_tree().create_timer(0.5).timeout
	frames = audio_effect_capture.get_frames_available() 
	print("VoiceChat: Frames after 0.5s: ", frames)
	
	if frames == 0:
		print("VoiceChat: ❌ Still no frames - microphone likely not working")
		print("VoiceChat: 💡 Check browser permission popup or microphone settings")
	else:
		print("VoiceChat: ✅ Microphone is working!")

func _setup_iframe_microphone() -> void:
	print("VoiceChat: Setting up iframe-specific microphone handling...")
	
	# Force microphone player to restart in case of iframe issues
	if microphone_player and microphone_player.stream:
		print("VoiceChat: Restarting microphone player for iframe compatibility")
		microphone_player.stop()
		await get_tree().process_frame
		microphone_player.play()
		
		# Wait a moment then check if it worked
		await get_tree().create_timer(0.5).timeout
		if microphone_player.playing:
			print("VoiceChat: ✅ Microphone player restarted successfully")
		else:
			print("VoiceChat: ❌ Microphone player failed to restart")
			_show_iframe_microphone_guide()

func _show_iframe_microphone_guide() -> void:
	print("🎙️ IFRAME MICROPHONE SETUP GUIDE")
	print("┌─────────────────────────────────────────────────────────┐")
	print("│  To enable microphone in iframe:                       │")
	print("│                                                         │")
	print("│  1. UPDATE YOUR IFRAME TAG:                            │")
	print("│     <iframe src='game-url'                              │")
	print("│             allow='microphone; autoplay'               │")
	print("│             sandbox='allow-scripts allow-same-origin'> │")
	print("│     </iframe>                                           │")
	print("│                                                         │")
	print("│  2. SERVE OVER HTTPS (required for microphone)         │")
	print("│                                                         │")
	print("│  3. BROWSER WILL PROMPT FOR PERMISSION                 │")
	print("│     - Click 'Allow' when asked for microphone          │")
	print("│                                                         │")
	print("│  4. CHECK BROWSER MICROPHONE SETTINGS                  │")
	print("│     - Ensure microphone isn't blocked for this site    │")
	print("└─────────────────────────────────────────────────────────┘")

var audio_chunks: Dictionary = {}  # session_id -> chunk data
var audio_buffer: PackedVector2Array = PackedVector2Array()  # Buffer for continuous audio capture
var last_transmission_time: float = 0.0  # Track transmission timing
var playback_buffers: Dictionary = {}  # session_id -> simple playback buffer for continuous audio
var playback_queue: Dictionary = {}  # session_id -> audio queue for smooth playback (legacy support)

func _on_voice_data_received(data) -> void:
	print("VoiceChat: _on_voice_data_received called with data: ", typeof(data))
	var session_id = data.get("session_id", "")
	var format = data.get("format", "bytes")
	var compression = data.get("compression", "")
	var received_sample_rate = data.get("sample_rate", SAMPLE_RATE)
	var chunk_info = data.get("chunk_info", {})
	
	print("VoiceChat: 🔴 RECEIVING VOICE DATA - session_id: '", session_id, "', format: ", format, ", compression: ", compression, ", sample_rate: ", received_sample_rate)
	if chunk_info.size() > 0:
		print("VoiceChat: 📦 CHUNK INFO - ", chunk_info)
	
	if session_id.length() > 0:
		if format == "frames_direct":
			# Direct float format (no byte conversion)
			var raw_frames = data.get("frames", [])
			print("VoiceChat: Received ", raw_frames.size(), " direct float frames (no conversion artifacts), type: ", typeof(raw_frames))
			
			# Process directly without chunking for simplicity
			_process_direct_float_frames(session_id, raw_frames, received_sample_rate)
		elif format == "frames_highprec" or format == "frames":
			# High-precision or regular frames format
			var raw_frames = data.get("frames", [])
			var precision_info = "high-precision (8 decimals)" if format == "frames_highprec" else "standard precision"
			print("VoiceChat: Received ", raw_frames.size(), " raw frames from web client (", precision_info, "), type: ", typeof(raw_frames), " compression: ", compression)
			
			# Handle chunked audio reconstruction
			if chunk_info.size() > 0:
				var total_chunks = chunk_info.get("total_chunks", 1)
				var chunk_index = chunk_info.get("chunk_index", 0)
				
				if total_chunks == 1:
					# Single chunk - process immediately
					print("VoiceChat: 🚀 Single chunk - processing immediately (", precision_info, ")")
					_process_complete_audio_frames(session_id, raw_frames, received_sample_rate, compression, format == "frames_highprec")
				else:
					# Multi-chunk - collect and reconstruct
					print("VoiceChat: 📦 Multi-chunk ", chunk_index + 1, "/", total_chunks, " - collecting... (", precision_info, ")")
					_collect_audio_chunk(session_id, chunk_info, raw_frames, received_sample_rate, compression, format == "frames_highprec")
			else:
				# Legacy format without chunking
				print("VoiceChat: 📼 Legacy format - processing directly (", precision_info, ")")
				_process_complete_audio_frames(session_id, raw_frames, received_sample_rate, compression, format == "frames_highprec")
		else:
			# Legacy byte format
			var audio_bytes = data.get("data", PackedByteArray())
			print("VoiceChat: Received ", audio_bytes.size(), " bytes from native client")
			if audio_bytes.size() > 0:
				voice_data_received.emit(session_id, audio_bytes)
				
				# TEMPORARY: Play audio directly to bypass VoiceUI connection issues
				print("VoiceChat: 🔊 DIRECT PLAYBACK: Playing audio directly (bypassing VoiceUI)")
				play_voice_data(audio_bytes, 0.8)  # Play at 80% volume for testing
			else:
				print("VoiceChat: No bytes in native voice data")
	else:
		print("VoiceChat: Invalid voice data received - no session_id")

func _process_direct_float_frames(session_id: String, raw_frames: Array, received_sample_rate: float) -> void:
	"""Process direct float frames (no byte conversion artifacts)"""
	print("VoiceChat: 🔊 Processing direct float frames: ", raw_frames.size(), " samples at ", received_sample_rate, "Hz")
	
	# Convert to PackedVector2Array (mono to stereo)
	var frames = PackedVector2Array()
	frames.resize(raw_frames.size())
	
	for i in range(raw_frames.size()):
		var sample = float(raw_frames[i])
		frames[i] = Vector2(sample, sample)  # Mono to stereo
	
	if frames.size() > 0:
		print("VoiceChat: 🔊 Direct float - playing ", frames.size(), " frames at ", received_sample_rate, "Hz")
		
		# Skip all processing - direct playback to test for artifacts
		_add_to_playback_buffer(session_id, frames, received_sample_rate)
	else:
		print("VoiceChat: No direct float frames to process")

func _collect_audio_chunk(session_id: String, chunk_info: Dictionary, raw_frames: Array, sample_rate: float, compression: String, is_high_precision: bool = false) -> void:
	"""Collect audio chunks and reconstruct complete audio when all chunks arrive"""
	var total_chunks = chunk_info.get("total_chunks", 1)
	var chunk_index = chunk_info.get("chunk_index", 0)
	var total_samples = chunk_info.get("total_samples", 0)
	
	# Initialize chunk collection for this session
	if not audio_chunks.has(session_id):
		audio_chunks[session_id] = {
			"chunks": {},
			"total_chunks": total_chunks,
			"total_samples": total_samples,
			"sample_rate": sample_rate,
			"compression": compression,
			"is_high_precision": is_high_precision,
			"timestamp": Time.get_ticks_msec()
		}
	
	var session_chunks = audio_chunks[session_id]
	session_chunks.chunks[chunk_index] = raw_frames
	
	print("VoiceChat: 📦 Collected chunk ", chunk_index + 1, "/", total_chunks, " for session ", session_id, " (", session_chunks.chunks.size(), " total)")
	
	# Check if we have all chunks
	if session_chunks.chunks.size() == total_chunks:
		print("VoiceChat: ✅ All chunks collected! Reconstructing complete audio...")
		
		# Reconstruct complete audio in order
		var complete_frames = []
		for i in range(total_chunks):
			if session_chunks.chunks.has(i):
				complete_frames.append_array(session_chunks.chunks[i])
			else:
				print("VoiceChat: ❌ Missing chunk ", i, " - cannot reconstruct")
				audio_chunks.erase(session_id)
				return
		
		print("VoiceChat: 🔧 Reconstructed ", complete_frames.size(), " frames from ", total_chunks, " chunks")
		
		# Process the complete audio immediately for better timing
		_process_complete_audio_frames(session_id, complete_frames, session_chunks.sample_rate, session_chunks.compression, session_chunks.get("is_high_precision", false))
		
		# Clean up
		audio_chunks.erase(session_id)
	else:
		# Set timeout to prevent memory leaks from incomplete chunks
		var timeout = 1000  # 1 second timeout
		if Time.get_ticks_msec() - session_chunks.timestamp > timeout:
			print("VoiceChat: ⏰ Chunk collection timeout for session ", session_id, " - cleaning up")
			audio_chunks.erase(session_id)

func _process_complete_audio_frames(session_id: String, raw_frames: Array, received_sample_rate: float, compression: String, _is_high_precision: bool = false) -> void:
	"""Process complete audio frames (either single chunk or reconstructed multi-chunk)"""
	print("VoiceChat: 🔊 Processing complete audio: ", raw_frames.size(), " frames at ", received_sample_rate, "Hz, compression: ", compression)
	
	# Convert regular array to PackedVector2Array
	var frames = PackedVector2Array()
	frames.resize(raw_frames.size())
	
	var max_amplitude = 0.0
	var non_zero_count = 0
	
	for i in range(raw_frames.size()):
		var raw_frame = raw_frames[i]
		var frame_vec = Vector2()
		
		if raw_frame is Array and raw_frame.size() >= 2:
			# Optimized conversion - same for both precision types
			frame_vec.x = float(raw_frame[0])
			frame_vec.y = float(raw_frame[1])
		else:
			# Handle unexpected format
			print("VoiceChat: ⚠️ Unexpected frame format at index ", i, ": ", typeof(raw_frame), " = ", raw_frame)
			frame_vec = Vector2.ZERO
		
		frames[i] = frame_vec
		
		# Check amplitude for debugging (only first 10 frames)
		if i < 10:
			var amplitude = max(abs(frame_vec.x), abs(frame_vec.y))
			if amplitude > max_amplitude:
				max_amplitude = amplitude
			if amplitude > 0.0:
				non_zero_count += 1
	
	print("VoiceChat: 🔊 FRAME DEBUG - Max amplitude: ", max_amplitude, " Non-zero frames: ", non_zero_count, "/", min(10, frames.size()))
	
	# Audio quality analysis
	var frame_range = max_amplitude - 0.0  # Dynamic range
	var avg_amplitude = 0.0
	for i in range(min(frames.size(), 50)):  # Check more frames for quality
		avg_amplitude += max(abs(frames[i].x), abs(frames[i].y))
	avg_amplitude /= min(frames.size(), 50)
	
	print("VoiceChat: 🔊 AUDIO QUALITY - Avg amplitude: ", avg_amplitude, " Dynamic range: ", frame_range)
	
	if raw_frames.size() > 0:
		print("VoiceChat: 🔊 First few raw frames: ", raw_frames.slice(0, min(3, raw_frames.size())))
		print("VoiceChat: 🔊 First few converted frames: ", frames.slice(0, min(3, frames.size())))
	
	if frames.size() > 0:
		# Handle decompression if needed (though we shouldn't have compression with 100% chunking)
		var final_frames = frames
		var playback_sample_rate = received_sample_rate
		
		if compression == "downsample_2x":
			print("VoiceChat: 🔄 Decompressing 2x downsampled audio...")
			final_frames = _upsample_audio(frames, 2)
			playback_sample_rate = SAMPLE_RATE  # Play at original sample rate
			print("VoiceChat: 🔄 Upsampled ", frames.size(), " to ", final_frames.size(), " frames for playback at ", playback_sample_rate, "Hz")
		elif compression == "downsample_4x":
			print("VoiceChat: 🔄 Decompressing 4x downsampled audio...")
			final_frames = _upsample_audio(frames, 4)
			playback_sample_rate = SAMPLE_RATE  # Play at original sample rate
			print("VoiceChat: 🔄 Upsampled ", frames.size(), " to ", final_frames.size(), " frames for playback at ", playback_sample_rate, "Hz")
		else:
			print("VoiceChat: 🔊 No decompression needed, playing ", frames.size(), " frames at ", playback_sample_rate, "Hz")
		
		# For web frames, convert to bytes for signal emission (for compatibility)
		var audio_bytes = audio_frames_to_bytes(final_frames)
		print("VoiceChat: Converted to ", audio_bytes.size(), " bytes for signal emission")
		voice_data_received.emit(session_id, audio_bytes)
		print("VoiceChat: ✅ Emitted voice_data_received signal for session: ", session_id, " with ", audio_bytes.size(), " bytes")
		
		# Skip smoothing to test for distortion source - add directly to playback
		_add_to_playback_buffer(session_id, final_frames, playback_sample_rate)
	else:
		print("VoiceChat: No frames in voice data")

func _send_audio_data(audio_data: PackedVector2Array) -> void:
	"""Send audio data as bytes using smart chunking"""
	if not room or not room.has_joined():
		return
	
	# Safety check for audio data size
	var total_samples = audio_data.size()
	if total_samples == 0:
		return
		
	var max_safe_chunk = 661  # Fast stable chunks (0.015s worth = 44100 * 0.015) - no overlap
	
	# Additional safety: limit total transmission size
	if total_samples > max_safe_chunk * 3:  # Allow more with bytes
		print("VoiceChat: ⚠️ Audio data too large (", total_samples, " samples), truncating")
		var truncated_data = PackedVector2Array()
		for i in range(max_safe_chunk * 3):
			truncated_data.append(audio_data[i])
		audio_data = truncated_data
		total_samples = audio_data.size()
	
	# Send as direct floats for clean audio (33fps should prevent word gaps)
	var float_array = []
	for frame in audio_data:
		float_array.append(frame.x)  # Use left channel (mono)
	
	print("VoiceChat: 🚀 CLEAN FLOAT SEND: ", total_samples, " samples as ", float_array.size(), " floats at 67fps")
	
	# Send as float array (clean audio, frequent transmission prevents gaps)
	if room and room.has_method("send"):
		room.send("voice_data", {
			"frames": float_array,
			"sample_rate": SAMPLE_RATE,
			"format": "frames_direct"
		})
		print("VoiceChat: ✅ Sent ", float_array.size(), " floats successfully")
	else:
		print("VoiceChat: ❌ Error: room not available for sending audio data")

func _request_microphone_permission() -> void:
	print("VoiceChat: 🎙️ Requesting microphone permission on user interaction...")
	
	# Force restart the microphone player with user interaction
	if microphone_player:
		microphone_player.stop()
		await get_tree().process_frame
		microphone_player.play()
		
		# Give it a moment to request permission
		await get_tree().create_timer(1.0).timeout
		
		if microphone_player.playing:
			print("VoiceChat: ✅ Microphone permission granted!")
		else:
			print("VoiceChat: ❌ Microphone permission denied or failed")
			_show_localhost_microphone_fix()

func _show_microphone_troubleshooting() -> void:
	print("🔧 MICROPHONE TROUBLESHOOTING")
	print("┌─────────────────────────────────────────────────────────┐")
	print("│  If microphone still doesn't work:                     │")
	print("│                                                         │")
	print("│  1. CHECK BROWSER URL BAR                              │")
	print("│     - Look for microphone icon                         │")
	print("│     - Click it and select 'Allow'                      │")
	print("│                                                         │")
	print("│  2. CHECK BROWSER SETTINGS                             │")
	print("│     - Go to site settings                              │")
	print("│     - Ensure microphone is 'Allow'                     │")
	print("│                                                         │")
	print("│  3. VERIFY HTTPS                                       │")
	print("│     - URL must start with https://                     │")
	print("│     - Microphone blocked on http://                    │")
	print("│                                                         │")
	print("│  4. TRY REFRESH                                        │")
	print("│     - Refresh page and try again                       │")
	print("│     - Clear browser cache if needed                    │")
	print("└─────────────────────────────────────────────────────────┘")

func _show_localhost_microphone_fix() -> void:
	print("🎙️ LOCALHOST MICROPHONE FIX")
	print("┌─────────────────────────────────────────────────────────┐")
	print("│  LOCALHOST MICROPHONE DOESN't AUTO-PROMPT!             │")
	print("│                                                         │")
	print("│  QUICK SOLUTIONS:                                       │")
	print("│                                                         │")
	print("│  🔧 METHOD 1: MANUAL BROWSER PERMISSION                │")
	print("│    1. Click lock/info icon in browser address bar      │")
	print("│    2. Set Microphone to 'Allow'                        │")
	print("│    3. Refresh page and try again                       │")
	print("│                                                         │")
	print("│  🌐 METHOD 2: USE NGROK (RECOMMENDED)                  │")
	print("│    1. Install ngrok: brew install ngrok                │")
	print("│    2. Run: ngrok http 3000                             │")
	print("│    3. Use the https://xxx.ngrok.io URL                 │")
	print("│    4. Browser will prompt for microphone permission    │")
	print("│                                                         │")
	print("│  ⚙️  METHOD 3: CHROME FLAGS (DEVELOPMENT)              │")
	print("│    1. Visit: chrome://flags/#unsafely-treat-insecure-  │")
	print("│       origins-as-secure                                │")
	print("│    2. Add: http://localhost:3000                       │")
	print("│    3. Restart Chrome                                   │")
	print("└─────────────────────────────────────────────────────────┘")

func _handle_core_audio_setup() -> void:
	print("VoiceChat: Handling Core Audio setup for macOS/Web...")
	
	# Give the audio system a moment to initialize
	await get_tree().process_frame
	
	# Try to recover from Core Audio errors
	if audio_effect_capture == null:
		print("VoiceChat: Attempting to reinitialize audio capture after Core Audio error")
		# Try to recreate the audio setup
		if record_bus_index != -1:
			# Remove any existing effects first
			for i in range(AudioServer.get_bus_effect_count(record_bus_index)):
				AudioServer.remove_bus_effect(record_bus_index, 0)
			
			# Add capture effect again
			audio_effect_capture = AudioEffectCapture.new()
			AudioServer.add_bus_effect(record_bus_index, audio_effect_capture)
			print("VoiceChat: Recreated AudioEffectCapture after Core Audio error")
	
	# Setup microphone input with error handling
	if microphone_player == null:
		print("VoiceChat: Attempting to reinitialize microphone after Core Audio error")
		if record_bus_index != -1:
			_setup_microphone_input(record_bus_index)

func _safe_setup_audio_capture() -> void:
	print("VoiceChat: Setting up audio capture with error handling...")
	
	# Call setup and check for success
	setup_audio_capture()
	
	# Check if setup was successful by verifying components exist
	if audio_effect_capture == null or microphone_player == null:
		print("VoiceChat: ❌ Audio capture setup failed - Core Audio error")
		print("VoiceChat: This is likely a macOS microphone permission issue")
		_show_macos_permission_fix()
	else:
		print("VoiceChat: ✅ Audio capture setup successful")

func _show_macos_permission_fix() -> void:
	print("🍎 macOS MICROPHONE PERMISSION FIX")
	print("┌─────────────────────────────────────────────────────────┐")
	print("│  CORE AUDIO ERROR = MISSING macOS PERMISSION           │")
	print("│                                                         │")
	print("│  REQUIRED STEPS:                                        │")
	print("│                                                         │")
	print("│  1️⃣  OPEN SYSTEM PREFERENCES                            │")
	print("│     → Security & Privacy → Privacy → Microphone        │")
	print("│                                                         │")
	print("│  2️⃣  ENABLE YOUR BROWSER                                │")
	print("│     ✅ Google Chrome                                    │")
	print("│     ✅ Safari                                           │")
	print("│     ✅ Firefox                                          │")
	print("│                                                         │")
	print("│  3️⃣  RESTART BROWSER                                    │")
	print("│     Completely quit and reopen browser                 │")
	print("│                                                         │")
	print("│  4️⃣  TEST AGAIN                                         │")
	print("│     Refresh page and try voice chat                    │")
	print("│                                                         │")
	print("│  NOTE: You may need to restart the entire app/game     │")
	print("└─────────────────────────────────────────────────────────┘")

func play_voice_data(audio_bytes: PackedByteArray, volume: float = 1.0) -> void:
	print("VoiceChat: play_voice_data called with ", audio_bytes.size(), " bytes at volume ", volume)
	if audio_bytes.size() == 0:
		print("VoiceChat: No audio data to play")
		return
	
	# Convert bytes back to audio frames
	var frames = bytes_to_audio_frames(audio_bytes)
	if frames.size() == 0:
		print("VoiceChat: No audio frames generated from bytes")
		return
	
	print("VoiceChat: Playing ", frames.size(), " frames at volume ", volume)
	
	# For web platform, use JavaScript Web Audio API for better compatibility
	if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
		_play_audio_via_web_audio(frames, volume)
		return
	
	# Fallback to Godot AudioStreamPlayer for native platforms
	_play_audio_via_godot(frames, volume)

func _upsample_audio(frames: PackedVector2Array, factor: int) -> PackedVector2Array:
	"""Upsample audio using linear interpolation for smooth playback"""
	var upsampled = PackedVector2Array()
	upsampled.resize(frames.size() * factor)
	
	for i in range(frames.size()):
		var current_frame = frames[i]
		var next_frame = frames[min(i + 1, frames.size() - 1)]  # Use last frame if at end
		
		# Linear interpolation between current and next frame
		for j in range(factor):
			var t = float(j) / float(factor)  # Interpolation factor 0.0 to 1.0
			var interpolated_frame = Vector2(
				lerp(current_frame.x, next_frame.x, t),
				lerp(current_frame.y, next_frame.y, t)
			)
			upsampled[i * factor + j] = interpolated_frame
	
	return upsampled

func _apply_audio_smoothing(frames: PackedVector2Array) -> PackedVector2Array:
	"""Apply gentle smoothing and normalization to prevent distortion"""
	if frames.size() < 3:
		return frames
	
	var smoothed = PackedVector2Array()
	smoothed.resize(frames.size())
	
	# First, find the maximum amplitude for normalization
	var max_amplitude = 0.0
	for frame in frames:
		var amplitude = max(abs(frame.x), abs(frame.y))
		if amplitude > max_amplitude:
			max_amplitude = amplitude
	
	# Calculate normalization factor (gentle, don't over-normalize)
	var normalization_factor = 1.0
	if max_amplitude > 0.7:  # Only normalize if amplitude is high
		normalization_factor = 0.7 / max_amplitude
	
	# Keep first frame as-is (with normalization)
	smoothed[0] = Vector2(
		frames[0].x * normalization_factor,
		frames[0].y * normalization_factor
	)
	
	# Apply gentle 3-point smoothing for middle frames
	for i in range(1, frames.size() - 1):
		var prev = frames[i - 1]
		var curr = frames[i]
		var next = frames[i + 1]
		
		# Very gentle smoothing: 10% prev + 80% curr + 10% next (preserve original more)
		var smoothed_x = (prev.x * 0.1 + curr.x * 0.8 + next.x * 0.1) * normalization_factor
		var smoothed_y = (prev.y * 0.1 + curr.y * 0.8 + next.y * 0.1) * normalization_factor
		
		smoothed[i] = Vector2(smoothed_x, smoothed_y)
	
	# Keep last frame as-is (with normalization)
	smoothed[frames.size() - 1] = Vector2(
		frames[frames.size() - 1].x * normalization_factor,
		frames[frames.size() - 1].y * normalization_factor
	)
	
	return smoothed

func _add_to_playback_buffer(session_id: String, frames: PackedVector2Array, sample_rate: float) -> void:
	"""Add audio directly to continuous streaming buffer for immediate playback"""
	print("VoiceChat: 🔊 Adding ", frames.size(), " frames directly to continuous stream")
	
	# Feed frames immediately to the continuous stream - no buffering, no delays
	_play_audio_via_web_audio_with_sample_rate(frames, sample_rate, 1.0)

func _queue_audio_for_playback(session_id: String, frames: PackedVector2Array, sample_rate: float) -> void:
	"""Queue audio for smooth playback to prevent choppy audio"""
	if not playback_queue.has(session_id):
		playback_queue[session_id] = {
			"frames": PackedVector2Array(),
			"sample_rate": sample_rate,
			"last_play_time": 0.0,
			"is_playing": false
		}
	
	var queue = playback_queue[session_id]
	queue.frames.append_array(frames)
	queue.sample_rate = sample_rate
	
	# If we have enough audio queued and not currently playing, start playback
	var min_queue_size = int(sample_rate * 0.05)  # 0.05 seconds of audio minimum (very responsive)
	if queue.frames.size() >= min_queue_size and not queue.is_playing:
		_start_queued_playback(session_id)

func _start_queued_playback(session_id: String) -> void:
	"""Start playing queued audio for smooth continuous playback"""
	if not playback_queue.has(session_id):
		return
		
	var queue = playback_queue[session_id]
	if queue.frames.size() == 0 or queue.is_playing:
		return
	
	queue.is_playing = true
	
	# Take a chunk of audio to play
	var chunk_size = int(queue.sample_rate * 0.04)  # 0.04 seconds worth (smaller, more frequent chunks)
	var play_frames = PackedVector2Array()
	
	for i in range(min(chunk_size, queue.frames.size())):
		play_frames.append(queue.frames[i])
	
	# Remove played frames from queue
	var remaining_frames = PackedVector2Array()
	for i in range(play_frames.size(), queue.frames.size()):
		remaining_frames.append(queue.frames[i])
	queue.frames = remaining_frames
	
	print("VoiceChat: 🎵 Playing queued audio: ", play_frames.size(), " frames, ", queue.frames.size(), " remaining")
	
	# Play the chunk
	_play_audio_via_web_audio_with_sample_rate(play_frames, queue.sample_rate, 1.0)
	
	# Schedule next chunk if more audio is queued
	if queue.frames.size() > 0:
		var delay = 0.035  # Slightly longer delay to match chunk duration better
		await get_tree().create_timer(delay).timeout
		queue.is_playing = false
		_start_queued_playback(session_id)  # Continue playing
	else:
		queue.is_playing = false

func _play_audio_via_web_audio_with_sample_rate(frames: PackedVector2Array, sample_rate: float, volume_gain: float = 1.0) -> void:
	"""Add audio to continuous playback buffer for seamless streaming"""
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		print("VoiceChat: Cannot play web audio - not on web platform")
		return
	
	if frames.size() == 0:
		print("VoiceChat: No frames to add to stream")
		return
	
	# Convert PackedVector2Array to flat array for JavaScript
	var flat_samples = []
	for frame in frames:
		flat_samples.append(frame.x)
		flat_samples.append(frame.y)
	
	var samples_str = ""
	for i in range(flat_samples.size()):
		if i > 0:
			samples_str += ","
		samples_str += str(flat_samples[i])
	
	var js_add_to_stream = """
	(function() {
		var audioSamples = [""" + samples_str + """];
		var sampleRate = """ + str(sample_rate) + """;
		var volumeGain = """ + str(volume_gain) + """;
		
		// Initialize continuous streaming system
		if (!window.continuousVoiceStream) {
			console.log('🔧 Initializing continuous voice stream...');
			
			// Create audio context
			window.voiceStreamContext = new (window.AudioContext || window.webkitAudioContext)({
				sampleRate: sampleRate
			});
			
			// Create continuous playback buffer
			window.continuousVoiceStream = {
				audioBuffer: [],
				isPlaying: false,
				sampleRate: sampleRate,
				volumeGain: volumeGain
			};
			
			// Create script processor optimized for anti-skipping (very small buffer = prevents loops)
			var scriptProcessor = window.voiceStreamContext.createScriptProcessor(512, 0, 2);
			var stream = window.continuousVoiceStream;
			
			scriptProcessor.onaudioprocess = function(event) {
				var outputLeft = event.outputBuffer.getChannelData(0);
				var outputRight = event.outputBuffer.getChannelData(1);
				var bufferLength = outputLeft.length;
				
				// Fill output buffer with anti-glitch protection
				var bufferUnderrun = false;
				for (var i = 0; i < bufferLength; i++) {
					if (stream.audioBuffer.length >= 2) {
						// Take stereo sample from buffer at full volume
						var leftSample = stream.audioBuffer.shift() * stream.volumeGain;
						var rightSample = stream.audioBuffer.shift() * stream.volumeGain;
						
						// Simple clamp without processing
						outputLeft[i] = Math.max(-1.0, Math.min(1.0, leftSample));
						outputRight[i] = Math.max(-1.0, Math.min(1.0, rightSample));
					} else {
						// Buffer underrun - output silence and flag for debugging
						outputLeft[i] = 0;
						outputRight[i] = 0;
						if (!bufferUnderrun) {
							bufferUnderrun = true;
						}
					}
				}
				
				// Debug buffer underruns (these cause glitches)
				if (bufferUnderrun) {
					console.log('⚠️ Audio buffer underrun detected - may cause word loss. Buffer size:', stream.audioBuffer.length);
				}
				
				// Monitor buffer health for anti-skipping (tighter thresholds)
				var bufferHealthCheck = Math.random() < 0.005; // Check occasionally
				if (bufferHealthCheck) {
					var bufferMs = (stream.audioBuffer.length / stream.sampleRate * 1000).toFixed(0);
					var status = stream.audioBuffer.length < 1102 ? '🟡 Low' : 
								stream.audioBuffer.length > 6615 ? '🔴 High' : '🟢 Good';
					console.log('🎤 Anti-skip buffer:', status, stream.audioBuffer.length, 'samples (' + bufferMs + 'ms)');
				}
			};
			
			// Connect processor to output
			scriptProcessor.connect(window.voiceStreamContext.destination);
			window.voiceStreamProcessor = scriptProcessor;
			
			console.log('✅ Continuous voice stream initialized');
		}
		
		// Resume context if suspended
		if (window.voiceStreamContext.state === 'suspended') {
			window.voiceStreamContext.resume();
		}
		
		// Add new audio samples to the continuous buffer
		for (var i = 0; i < audioSamples.length; i++) {
			window.continuousVoiceStream.audioBuffer.push(audioSamples[i]);
		}
		
		console.log('🎵 Added', audioSamples.length, 'samples to continuous stream. Buffer size:', window.continuousVoiceStream.audioBuffer.length);
		
		// Anti-skipping buffer management for 50fps
		var maxBufferSize = sampleRate * 0.3; // 0.3 seconds max (prevents skipping loops)
		var minBufferSize = sampleRate * 0.05; // 0.05 seconds minimum (prevents underruns)
		
		if (window.continuousVoiceStream.audioBuffer.length > maxBufferSize) {
			// Prevent CD skipping by careful buffer management
			// Remove oldest audio but keep enough to prevent underruns
			var targetSize = Math.floor(maxBufferSize * 0.6); // Keep 60% of max (prevents loops)
			var excess = window.continuousVoiceStream.audioBuffer.length - targetSize;
			window.continuousVoiceStream.audioBuffer.splice(0, excess);
			console.log('🚫 Anti-skip buffer trim:', excess, 'samples removed, kept', targetSize);
		}
		
		// Debug buffer state for sustained speech analysis
		if (Math.random() < 0.02) {
			console.log('🎤 Speech buffer state:', window.continuousVoiceStream.audioBuffer.length, 'samples,', 
						(window.continuousVoiceStream.audioBuffer.length / sampleRate * 1000).toFixed(0), 'ms');
		}
	})();
	"""
	
	JavaScriptBridge.eval(js_add_to_stream)

func _play_audio_via_web_audio(frames: PackedVector2Array, volume: float) -> void:
	"""Play audio using JavaScript Web Audio API for web platforms"""
	
	# Convert frames to a format JavaScript can use
	var samples_array = []
	for frame in frames:
		samples_array.append(frame.x)  # Use left channel (mono)
	
	# Create JavaScript code to play audio
	var js_play_code = """
	(function() {
		try {
			// Ensure we have an audio context for playback
			if (!window.audioOutputContext) {
				window.audioOutputContext = new (window.AudioContext || window.webkitAudioContext)({
					sampleRate: 44100
				});
				console.log('🔊 Created audio output context for voice playback at 44100Hz');
			}
			
			var audioContext = window.audioOutputContext;
			var samples = """ + var_to_str(samples_array) + """;
			var volume = """ + str(volume) + """;
			
			console.log('🔊 Audio context state:', audioContext.state);
			console.log('🔊 Audio context sample rate:', audioContext.sampleRate);
			console.log('🔊 Audio context destination:', audioContext.destination);
			
			// Function to actually play the audio
			function playAudio() {
				try {
					// Create buffer for the audio data - use 44100Hz to match capture
					var buffer = audioContext.createBuffer(1, samples.length, 44100);
					var channelData = buffer.getChannelData(0);
					
					// Copy samples to buffer with debugging and minimal processing
					var maxSample = 0;
					for (var i = 0; i < samples.length; i++) {
						var sample = samples[i] * volume;
						
						// Clamp to prevent clipping (no smoothing - might be causing artifacts)
						sample = Math.max(-1.0, Math.min(1.0, sample));
						
						channelData[i] = sample;
						if (Math.abs(sample) > maxSample) {
							maxSample = Math.abs(sample);
						}
					}
					
					console.log('🔊 Max sample value after volume:', maxSample);
					console.log('🔊 Buffer created with', samples.length, 'samples');
					
					// Create buffer source and connect to output
					var source = audioContext.createBufferSource();
					source.buffer = buffer;
					
					// Apply volume
					var gainNode = audioContext.createGain();
					gainNode.gain.value = volume;
					
					// Connect: source -> gain -> speakers
					source.connect(gainNode);
					gainNode.connect(audioContext.destination);
					
					// Add event listeners for debugging
					source.onended = function() {
						console.log('🔊 Audio playback ended');
					};
					
					// Play the audio
					source.start();
					console.log('🔊 ✅ Audio playback started successfully');
					
				} catch (playError) {
					console.error('🔊 ❌ Error during audio playback:', playError);
				}
			}
			
			// Resume context if suspended (required by browsers)
			if (audioContext.state === 'suspended') {
				console.log('🔊 Audio context suspended, attempting to resume...');
				audioContext.resume().then(() => {
					console.log('🔊 ✅ Audio context resumed for playback');
					playAudio();
				}).catch((resumeError) => {
					console.error('🔊 ❌ Failed to resume audio context:', resumeError);
				});
			} else {
				console.log('🔊 Audio context ready, playing immediately');
				playAudio();
			}
			
		} catch (error) {
			console.error('🔊 ❌ Error in voice audio playback:', error);
		}
	})();
	"""
	
	JavaScriptBridge.eval(js_play_code)
	print("VoiceChat: Playing ", frames.size(), " frames via Web Audio API at volume ", volume)

func _play_audio_via_godot(frames: PackedVector2Array, volume: float) -> void:
	"""Play audio using Godot's AudioStreamPlayer for native platforms"""
	
	# Create AudioStreamGenerator for real-time playback
	var stream = AudioStreamGenerator.new()
	stream.sample_rate = SAMPLE_RATE
	stream.buffer_length = 0.1  # 100ms buffer
	
	audio_stream_player.stream = stream
	audio_stream_player.volume_db = linear_to_db(volume)
	audio_stream_player.play()
	
	# Get the playback stream and push frames
	var playback = audio_stream_player.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback:
		playback.push_buffer(frames)

func _input(event: InputEvent) -> void:
	# Debug any key input to check if iframe has focus (for development)
	if event is InputEventKey:
		print("VoiceChat: Key input detected - key: ", event.keycode, " pressed: ", event.pressed)
	
	# V key functionality removed - microphone is now controlled entirely by UI toggle

func calculate_proximity_volume(distance: float) -> float:
	print("VoiceChat: calculate_proximity_volume called with distance: ", distance)
	print("VoiceChat: Current proximity_range: ", proximity_range)
	
	if distance > proximity_range:
		print("VoiceChat: Distance ", distance, " > proximity_range ", proximity_range, " - returning 0.0")
		return 0.0
	
	# Create realistic proximity zones with exponential falloff
	var volume = 0.0
	
	if distance < 30.0:
		# Very close: full volume (0-30 pixels)
		volume = 1.0
		print("VoiceChat: Very close zone (< 30) - volume: ", volume)
	elif distance < 60.0:
		# Close: slight falloff (30-60 pixels)
		volume = 0.8 + (0.2 * (1.0 - (distance - 30.0) / 30.0))
		print("VoiceChat: Close zone (30-60) - volume: ", volume)
	elif distance < 100.0:
		# Medium: noticeable falloff (60-100 pixels)
		var zone_progress = (distance - 60.0) / 40.0
		volume = 0.8 * (1.0 - (zone_progress * zone_progress))  # Quadratic falloff
		print("VoiceChat: Medium zone (60-100) - volume: ", volume)
	else:
		# Far: rapid falloff to silence (100-150 pixels)
		var zone_progress = (distance - 100.0) / 50.0
		# Exponential falloff for realistic distance effect
		volume = 0.3 * pow(1.0 - zone_progress, 3.0)
		print("VoiceChat: Far zone (100-150) - volume: ", volume)
	
	return volume

func set_voice_enabled(enabled: bool) -> void:
	print("VoiceChat: 🎤 Setting voice_enabled to: ", enabled)
	print("VoiceChat: 🎤 Current voice_enabled state: ", voice_enabled)
	print("VoiceChat: 🎤 Current is_recording state: ", is_recording)
	print("VoiceChat: 🎤 Node path: ", get_path())
	print("VoiceChat: 🎤 Node name: ", name)
	
	voice_enabled = enabled
	
	if enabled:
		print("VoiceChat: 🟢 Enabling microphone system...")
		print("VoiceChat: 🟢 About to call _setup_complete_microphone_system()")
		_setup_complete_microphone_system()
		print("VoiceChat: 🟢 Finished calling _setup_complete_microphone_system()")
	else:
		print("VoiceChat: 🔴 Disabling microphone system...")
		_pause_microphone_system()  # Just pause instead of destroying
	
	print("VoiceChat: ✅ Voice control complete - voice_enabled: ", voice_enabled)
	print("VoiceChat: ✅ Final is_recording state: ", is_recording)

func _get_web_audio_data() -> PackedVector2Array:
	"""Get audio data from JavaScript Web Audio API"""
	if not Engine.has_singleton("JavaScriptBridge"):
		return PackedVector2Array()
	
	var js_code = """
	(function() {
		// Debug the current state
		if (!window.webAudioData) {
			console.log('🐛 webAudioData does not exist');
			return "";
		}
		
		console.log('🐛 webAudioData exists:', {
			isCapturing: window.webAudioData.isCapturing,
			bufferLength: window.webAudioData.audioBuffer ? window.webAudioData.audioBuffer.length : 'no buffer',
			setupComplete: window.webAudioData.setupComplete,
			hasStream: !!window.webAudioData.stream,
			hasScriptProcessor: !!window.webAudioData.scriptProcessor
		});
		
		if (!window.webAudioData.isCapturing) {
			console.log('🐛 Not capturing - isCapturing:', window.webAudioData.isCapturing);
			return "";
		}
		
		if (!window.webAudioData.audioBuffer || window.webAudioData.audioBuffer.length === 0) {
			console.log('🐛 No audio buffer data - buffer length:', window.webAudioData.audioBuffer ? window.webAudioData.audioBuffer.length : 'null');
			return "";
		}
		
		// Get samples from buffer and prepare for Godot
		var samples = window.webAudioData.audioBuffer.splice(0, Math.min(256, window.webAudioData.audioBuffer.length));
		console.log('🐛 Extracted samples:', samples.length, 'first few:', samples.slice(0, 5));
		
		// Convert to string format that Godot can parse
		var result = samples.join(",");
		return result;
	})();
	"""
	
	var result = JavaScriptBridge.eval(js_code)
	if result == null or result == "":
		return PackedVector2Array()
	
	# Parse the comma-separated string into audio frames
	var audio_frames = PackedVector2Array()
	var samples = str(result).split(",")
	
	# Convert to stereo frames (assuming mono input, duplicate for stereo)
	for i in range(0, samples.size(), 1):
		if samples[i] != "":
			var sample_value = float(samples[i])
			audio_frames.append(Vector2(sample_value, sample_value))
	
	return audio_frames

func _setup_web_microphone() -> void:
	"""Set up JavaScript Web Audio API for microphone capture"""
	print("VoiceChat: Setting up web microphone...")
	
	if not Engine.has_singleton("JavaScriptBridge"):
		print("VoiceChat: JavaScriptBridge not available")
		return
	
	# Skip if already set up OR if webAudioData already exists and is working
	if web_audio_setup_done:
		print("VoiceChat: Web audio already set up, skipping...")
		return
	
	# Check if a working webAudioData already exists
	if Engine.has_singleton("JavaScriptBridge"):
		var check_existing = """
		(function() {
			if (window.webAudioData && window.webAudioData.audioBuffer) {
				console.log('🔧 Existing webAudioData found - skipping duplicate setup');
				return true;
			}
			return false;
		})();
		"""
		var existing_setup = JavaScriptBridge.eval(check_existing)
		if existing_setup:
			print("VoiceChat: Existing working web audio setup found, skipping duplicate setup")
			web_audio_setup_done = true
			return
	
	var js_setup_code = """
	(async function() {
		console.log('Setting up web audio capture...');
		
		try {
			// Request microphone access with better settings
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					channelCount: 1,
					sampleRate: 44100  // Use standard sample rate
				},
				video: false
			});
			
			console.log('Microphone access granted!');
			console.log('Audio tracks:', stream.getAudioTracks().length);
			
			// Create audio context with standard sample rate
			const audioContext = new (window.AudioContext || window.webkitAudioContext)({
				sampleRate: 44100
			});
			
			// Create audio source from stream
			const source = audioContext.createMediaStreamSource(stream);
			
		// Create script processor with balanced buffer for smooth speech capture
		const scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1);
			
			// Set up audio data capture
			window.webAudioData = {
				audioContext: audioContext,
				source: source,
				scriptProcessor: scriptProcessor,
				stream: stream,
				audioBuffer: [],
				isCapturing: false,
				setupComplete: true
			};
			
			// Handle audio processing
			scriptProcessor.onaudioprocess = function(event) {
				if (!window.webAudioData.isCapturing) return;
				
				const inputBuffer = event.inputBuffer.getChannelData(0);
				const samples = Array.from(inputBuffer);
				
				// Add to buffer with smoother management
				window.webAudioData.audioBuffer.push(...samples);
				
				// Prevent buffer overflow with balanced capture
				if (window.webAudioData.audioBuffer.length > 13230) {  // 0.3 seconds at 44.1kHz - balanced
					// Remove older samples gently - keep 80% of buffer for stability
					var keepSize = Math.floor(window.webAudioData.audioBuffer.length * 0.8);
					window.webAudioData.audioBuffer = window.webAudioData.audioBuffer.slice(-keepSize);
				}
				
				// Debug occasionally
				if (Math.random() < 0.05) {
					const maxAmplitude = Math.max(...samples.map(Math.abs));
					if (maxAmplitude > 0.01) {
						console.log('JavaScript: Audio detected! Samples:', samples.length, 'Max amplitude:', maxAmplitude.toFixed(4));
						console.log('JavaScript: Audio buffer now has', window.webAudioData.audioBuffer.length, 'samples');
					}
				}
			};
			
			// Connect the nodes
			source.connect(scriptProcessor);
			scriptProcessor.connect(audioContext.destination);
			
			console.log('✅ Web audio capture setup complete');
		console.log('✅ webAudioData keys:', Object.keys(window.webAudioData));
		console.log('✅ ScriptProcessor buffer size:', scriptProcessor.bufferSize);
		console.log('✅ Audio buffer initialized with length:', window.webAudioData.audioBuffer.length);
			return true;
		} catch (error) {
			console.error('Error setting up web audio:', error);
			return false;
		}
	})();
	"""
	
	var result = JavaScriptBridge.eval(js_setup_code)
	print("VoiceChat: Web audio setup result: ", result)
	
	web_audio_setup_done = true

func _setup_microphone_input(_record_bus_index: int) -> void:
	"""Set up native microphone input for desktop platforms"""
	print("VoiceChat: Setting up native microphone input...")
	
	# Create AudioEffectCapture for recording
	if not audio_effect_capture:
		audio_effect_capture = AudioEffectCapture.new()
		AudioServer.add_bus_effect(_record_bus_index, audio_effect_capture)
		print("VoiceChat: Added AudioEffectCapture to bus ", _record_bus_index)
	
	# Create microphone player for input
	if not microphone_player:
		microphone_player = AudioStreamPlayer.new()
		microphone_player.bus = AudioServer.get_bus_name(_record_bus_index)
		add_child(microphone_player)
		print("VoiceChat: Created microphone player on bus ", microphone_player.bus)
	
	# Set up microphone stream
	var mic_stream = AudioStreamMicrophone.new()
	microphone_player.stream = mic_stream
	microphone_player.play()
	
	print("VoiceChat: Native microphone input setup complete")

func _setup_complete_microphone_system() -> void:
	"""Set up the complete microphone system from scratch"""
	print("VoiceChat: 🚀 Setting up complete microphone system...")
	print("VoiceChat: 🚀 Platform check - OS.has_feature('web'): ", OS.has_feature("web"))
	
	# Reset everything to ensure clean state
	is_recording = false
	web_audio_setup_done = false
	print("VoiceChat: 🚀 Reset flags - is_recording: ", is_recording, " web_audio_setup_done: ", web_audio_setup_done)
	
	if OS.has_feature("web"):
		print("VoiceChat: Web platform - setting up JavaScript audio...")
		print("VoiceChat: 🚀 About to call _setup_web_microphone()")
		_setup_web_microphone()
		print("VoiceChat: 🚀 Finished _setup_web_microphone(), waiting for process frame...")
		
		# Also ensure the existing setup is marked as ready
		if Engine.has_singleton("JavaScriptBridge"):
			JavaScriptBridge.eval("if (window.webAudioData && !window.webAudioData.setupComplete) { window.webAudioData.setupComplete = true; console.log('🔧 Marked existing setup as complete'); }")
		# Wait longer for JavaScript setup to complete before enabling capture
		await get_tree().create_timer(0.2).timeout  # Give JavaScript time to finish setup
		print("VoiceChat: 🚀 Setting is_recording = true")
		is_recording = true
		print("VoiceChat: 🚀 About to enable JavaScript capturing...")
		if Engine.has_singleton("JavaScriptBridge"):
			var js_enable_code = """
			(function() {
				console.log('🎤 ATTEMPTING to enable capturing...');
				
				// Check if webAudioData exists and is properly set up
				if (!window.webAudioData) {
					console.log('❌ No webAudioData found when trying to enable capturing');
					console.log('❌ Available window properties:', Object.keys(window).filter(k => k.includes('audio')));
					return false;
				}
				
				// Check if webAudioData has required properties
				if (!window.webAudioData.audioBuffer || !window.webAudioData.scriptProcessor) {
					console.log('❌ webAudioData missing required properties');
					console.log('❌ webAudioData keys:', Object.keys(window.webAudioData));
					return false;
				}
				
				console.log('🎤 Before setting: isCapturing =', window.webAudioData.isCapturing);
				window.webAudioData.isCapturing = true;
				console.log('🎤 After setting: isCapturing =', window.webAudioData.isCapturing);
				console.log('🎤 Buffer size:', window.webAudioData.audioBuffer.length);
				console.log('✅ Microphone ENABLED and capturing');
				return true;
			})();
			"""
			var enable_result = JavaScriptBridge.eval(js_enable_code)
			print("VoiceChat: JavaScript enable result: ", enable_result)
			
			# If enabling failed, try again after a short delay
			if enable_result == false or enable_result == null:
				print("VoiceChat: ⚠️ Failed to enable capturing, will retry...")
				await get_tree().create_timer(0.1).timeout
				JavaScriptBridge.eval(js_enable_code)
	else:
		print("VoiceChat: Native platform - setting up native audio...")
		_setup_microphone_input(record_bus_index)
		is_recording = true
	
	print("VoiceChat: ✅ Complete microphone system setup finished - is_recording: ", is_recording)

func _pause_microphone_system() -> void:
	"""Pause the microphone system without destroying it"""
	print("VoiceChat: ⏸️ Pausing microphone system...")
	
	# Stop recording
	is_recording = false
	
	if OS.has_feature("web"):
		print("VoiceChat: Web platform - pausing JavaScript audio capture...")
		if Engine.has_singleton("JavaScriptBridge"):
			var js_pause_code = """
			(function() {
				console.log('⏸️ PAUSING web audio capture...');
				if (window.webAudioData) {
					// Just stop capturing, but keep everything alive
					window.webAudioData.isCapturing = false;
					console.log('⏸️ Set isCapturing to false - system ready to resume');
				} else {
					console.log('⏸️ No webAudioData to pause');
				}
			})();
			"""
			JavaScriptBridge.eval(js_pause_code)
			print("VoiceChat: JavaScript audio capture paused")
	
	print("VoiceChat: ✅ Microphone system paused - ready to resume")

func _destroy_complete_microphone_system() -> void:
	"""Completely destroy the microphone system"""
	print("VoiceChat: 🧨 Destroying complete microphone system...")
	
	# Stop recording immediately
	is_recording = false
	
	if OS.has_feature("web"):
		print("VoiceChat: Web platform - destroying JavaScript audio...")
		if Engine.has_singleton("JavaScriptBridge"):
			var js_destroy_code = """
			(function() {
				console.log('🧨 DESTROYING web audio completely...');
				if (window.webAudioData) {
					// Stop capturing
					window.webAudioData.isCapturing = false;
					
					// Stop and disconnect everything
					if (window.webAudioData.stream) {
						window.webAudioData.stream.getTracks().forEach(track => {
							track.stop();
							console.log('🛑 Stopped track:', track.kind);
						});
						window.webAudioData.stream = null;
					}
					
					if (window.webAudioData.scriptProcessor) {
						window.webAudioData.scriptProcessor.disconnect();
						window.webAudioData.scriptProcessor = null;
					}
					
					if (window.webAudioData.source) {
						window.webAudioData.source.disconnect();
						window.webAudioData.source = null;
					}
					
					if (window.webAudioData.audioContext) {
						window.webAudioData.audioContext.close();
						window.webAudioData.audioContext = null;
					}
					
					// Clear everything
					window.webAudioData.audioBuffer = [];
					window.webAudioData.setupComplete = false;
					
					console.log('🧨 Web audio COMPLETELY DESTROYED');
				}
			})();
			"""
			JavaScriptBridge.eval(js_destroy_code)
	else:
		print("VoiceChat: Native platform - cleaning up native audio...")
		if audio_effect_capture:
			audio_effect_capture.clear_buffer()
		if microphone_player:
			microphone_player.stop()
	
	# Reset flags
	web_audio_setup_done = false
	
	print("VoiceChat: ✅ Complete microphone system destroyed - is_recording: ", is_recording)
