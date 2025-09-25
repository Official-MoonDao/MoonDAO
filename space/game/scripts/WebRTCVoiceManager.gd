# res://scripts/WebRTCVoiceManager.gd
# Simplified WebRTC Voice Chat Manager
extends Node

signal voice_chat_enabled_changed(enabled: bool)
signal proximity_volume_changed(session_id: String, volume: float)
signal microphone_ready_changed(is_ready: bool)
# player_talking_changed signal removed

# Voice chat state
var voice_enabled := false
var is_recording := false

# Colyseus room reference
var room: Object = null
var main_net_client: Node = null
var pending_offers: Array[String] = []  # Store session IDs for delayed offers
var offer_timer: Timer = null  # Timer for delayed offer creation
# Talking poll timer variable removed

# WebRTC management
var peer_connections: Dictionary = {}  # session_id -> RTCPeerConnection data
var local_stream: Object = null
var audio_context: Object = null

# Proximity voice settings
var proximity_range := 800.0  # Proximity distance in pixels (realistic voice chat range)
var local_player_position: Vector2 = Vector2.ZERO
var player_positions: Dictionary = {}  # session_id -> Vector2

# Team room spatial audio isolation
var current_voice_zone: String = "lobby"  # Current voice zone: "lobby" or team room ID
var player_voice_zones: Dictionary = {}  # session_id -> voice_zone

func _ready() -> void:
	print("WebRTCVoiceManager: Initializing simplified voice chat system")
	add_to_group("voice_chat")
	
	# Create timer for delayed offer creation
	offer_timer = Timer.new()
	offer_timer.wait_time = 0.5
	offer_timer.one_shot = true
	offer_timer.timeout.connect(_process_pending_offers)
	add_child(offer_timer)
	
	# Talking state polling timer removed
	
	# Talking indicator test timers removed

func set_room(colyseus_room: Object) -> void:
	"""Set the Colyseus room for WebRTC signaling"""
	print("WebRTCVoiceManager: 🎤 set_room called with: ", colyseus_room)
	room = colyseus_room
	if room:
		print("WebRTCVoiceManager: 🎤 Room is valid, setting up message handlers...")
		# Listen for WebRTC signaling messages
		room.on_message("webrtc_offer").on(Callable(self, "_on_webrtc_offer"))
		room.on_message("webrtc_answer").on(Callable(self, "_on_webrtc_answer"))
		room.on_message("webrtc_ice_candidate").on(Callable(self, "_on_webrtc_ice_candidate"))
		room.on_message("voice_chat_peer_joined").on(Callable(self, "_on_peer_joined"))
		room.on_message("voice_chat_peer_left").on(Callable(self, "_on_peer_left"))
		room.on_message("voice_chat_peers_list").on(Callable(self, "_on_peers_list"))
		
		# Set up JavaScript bridge to Colyseus room
		_setup_javascript_room_bridge()
		
		# Automatically join voice chat for listening (even without microphone)
		_join_voice_chat_for_listening()
		
		print("WebRTCVoiceManager: ✅ Connected to room for WebRTC signaling")
	else:
		print("WebRTCVoiceManager: ❌ Room is null!")

func set_main_net_client(client: Node) -> void:
	"""Set reference to MainNetClient for player position access"""
	main_net_client = client

func set_voice_enabled(enabled: bool) -> void:
	"""Enable or disable voice chat"""
	print("WebRTCVoiceManager: Setting voice enabled to: ", enabled)
	
	if enabled == voice_enabled:
		return
	
	voice_enabled = enabled
	
	if enabled:
		_start_voice_chat()
		
		# Send join message to server to announce we're now talking
		if room:
			print("WebRTCVoiceManager: 🎤 Sending voice_chat_join message to server...")
			room.send("voice_chat_join", {})
			print("WebRTCVoiceManager: 🎤 voice_chat_join message sent")
			
		# When enabling mic, create offers to all existing players (after mic is ready)
		print("WebRTCVoiceManager: 🎤 Waiting for microphone to be ready...")
		microphone_ready_changed.emit(false)  # Signal that mic is not ready yet
		_wait_for_mic_ready_and_create_offers()
		
	else:
		_stop_voice_chat()
	
	voice_chat_enabled_changed.emit(enabled)

func get_voice_enabled() -> bool:
	return voice_enabled

func get_is_recording() -> bool:
	return is_recording

func _start_voice_chat() -> void:
	"""Start voice chat system"""
	print("WebRTCVoiceManager: Starting voice chat...")
	
	if not OS.has_feature("web"):
		print("WebRTCVoiceManager: ❌ WebRTC voice chat only supported on web platform")
		return
	
	if not Engine.has_singleton("JavaScriptBridge"):
		print("WebRTCVoiceManager: ❌ JavaScriptBridge not available")
		return
	
	# Initialize WebRTC in browser
	var js_init_code = """
	(async function() {
		console.log('🎤 Initializing WebRTC voice chat...');
		
		try {
			// Initialize if not already done
			if (!window.webrtcVoiceManager) {
				window.webrtcVoiceManager = {
					localStream: null,
					peerConnections: new Map(),
					audioContext: null,
					isEnabled: false
				};
			}
			
			const voiceManager = window.webrtcVoiceManager;
			
			// Only get microphone access if we're actually going to talk
			// For listening-only, we skip microphone access
			if (!voiceManager.localStream) {
				console.log('🎤 Requesting microphone access...');
				voiceManager.localStream = await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true,
						channelCount: 1,
						sampleRate: 44100
					},
					video: false
				});
				console.log('✅ Microphone access granted');
			}
			
			// Create audio context for proximity volume control
			if (!voiceManager.audioContext) {
				voiceManager.audioContext = new (window.AudioContext || window.webkitAudioContext)();
				console.log('✅ Audio context created, state:', voiceManager.audioContext.state);
			}
			
			// Resume audio context if suspended (required for audio playback)
			if (voiceManager.audioContext.state === 'suspended') {
				await voiceManager.audioContext.resume();
				console.log('✅ Audio context resumed, state:', voiceManager.audioContext.state);
			}
			
			voiceManager.isEnabled = true;
			console.log('✅ WebRTC voice chat initialized successfully');
			
			// Set up helper functions
			""" + _get_webrtc_helper_functions() + """
			
			return true;
			
		} catch (error) {
			console.error('❌ Failed to initialize WebRTC voice chat:', error);
			return false;
		}
	})();
	"""
	
	# Start the async initialization
	JavaScriptBridge.eval(js_init_code)
	
	# Assume success since JavaScript will handle async completion
	# The JS code will log success/failure independently
	is_recording = true
	print("WebRTCVoiceManager: ✅ Voice chat initialization started (async)")
	
	# Join voice chat room
	if room:
		var player_pos = {"x": local_player_position.x, "y": local_player_position.y}
		print("WebRTCVoiceManager: 🎤 Sending voice_chat_join message to server...")
		room.send("voice_chat_join", {"position": player_pos})
		print("WebRTCVoiceManager: 🎤 voice_chat_join message sent")
	else:
		print("WebRTCVoiceManager: ❌ No room available to send voice_chat_join!")

func _stop_voice_chat() -> void:
	"""Stop voice chat system"""
	print("WebRTCVoiceManager: Stopping voice chat...")
	
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	
	# Cleanup WebRTC connections
	var js_cleanup_code = """
	(function() {
		console.log('🎤 Cleaning up WebRTC voice chat...');
		
		if (window.webrtcVoiceManager) {
			const voiceManager = window.webrtcVoiceManager;
			
			// Close all peer connections
			voiceManager.peerConnections.forEach((pc, sessionId) => {
				console.log('Closing peer connection for:', sessionId);
				pc.close();
			});
			voiceManager.peerConnections.clear();
			
			// Stop local stream
			if (voiceManager.localStream) {
				voiceManager.localStream.getTracks().forEach(track => {
					track.stop();
					console.log('Stopped track:', track.kind);
				});
				voiceManager.localStream = null;
			}
			
			// Close audio context
			if (voiceManager.audioContext && voiceManager.audioContext.state !== 'closed') {
				voiceManager.audioContext.close();
			}
			
			voiceManager.isEnabled = false;
			console.log('✅ WebRTC voice chat cleaned up');
		}
	})();
	"""
	
	JavaScriptBridge.eval(js_cleanup_code)
	
	# Clear Godot peer connections tracking
	peer_connections.clear()
	print("WebRTCVoiceManager: 🗑️ Cleared Godot peer connections")
	
	is_recording = false
	
	# Leave voice chat room
	if room:
		room.send("voice_chat_leave", {})
	
	print("WebRTCVoiceManager: ✅ Voice chat stopped")

func _on_webrtc_offer(data) -> void:
	"""Handle WebRTC offer from another peer"""
	print("WebRTCVoiceManager: Received WebRTC offer from: ", data.fromSessionId)
	
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	
	# Convert offer to JSON string for safe JavaScript injection
	var json_offer = JSON.stringify(data.offer)
	var js_handle_offer = """
	(async function() {
		try {
			const fromSessionId = '""" + str(data.fromSessionId) + """';
			const offer = """ + json_offer + """;
			
			console.log('🎤 Handling WebRTC offer from:', fromSessionId);
			
			// Initialize WebRTC manager for listen-only mode if not already initialized
			if (!window.webrtcVoiceManager) {
				console.log('🎤 Initializing WebRTC voice manager for listen-only mode...');
				window.webrtcVoiceManager = {
					isEnabled: true,
					localStream: null,
					peerConnections: new Map()
				};
			}
			
			const voiceManager = window.webrtcVoiceManager;
			
			// Create peer connection
			const pc = new RTCPeerConnection({
				iceServers: [
					{ urls: 'stun:stun.l.google.com:19302' },
					{ urls: 'stun:stun1.l.google.com:19302' }
				]
			});
			
			// Add local stream
			if (voiceManager.localStream) {
				console.log('🎤 Adding local stream tracks to peer connection');
				voiceManager.localStream.getTracks().forEach(track => {
					console.log('🎤 Adding track:', track.kind, 'enabled:', track.enabled);
					pc.addTrack(track, voiceManager.localStream);
				});
			} else {
				console.log('🎤 No local stream - creating listen-only connection');
			}
			
			// Handle remote stream
			pc.ontrack = (event) => {
				console.log('🎤 Received remote stream tracks:', event.track.kind, 'from:', fromSessionId);
				console.log('🎤 Event streams count:', event.streams.length);
				if (event.streams.length > 0) {
					const remoteStream = event.streams[0];
					console.log('🎤 Remote stream tracks:', remoteStream.getTracks().map(t => t.kind + ':' + t.enabled));
					window.handleRemoteAudioStream(fromSessionId, remoteStream);
				} else {
					console.error('❌ No streams in track event!');
				}
			};
			
			// Handle ICE candidates
			pc.onicecandidate = (event) => {
				if (event.candidate) {
					console.log('🎤 Sending ICE candidate to:', fromSessionId);
					window.sendICECandidate(fromSessionId, event.candidate);
				}
			};
			
			// Set remote description and create answer
			await pc.setRemoteDescription(offer);
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			
			// Store peer connection
			voiceManager.peerConnections.set(fromSessionId, pc);
			
			// Send answer back
			window.sendWebRTCAnswer(fromSessionId, answer);
			
			console.log('✅ WebRTC offer handled successfully');
			return true;
			
		} catch (error) {
			console.error('❌ Error handling WebRTC offer:', error);
			return false;
		}
	})();
	"""
	
	# Set up helper functions for Godot communication
	_setup_webrtc_helpers()
	
	JavaScriptBridge.eval(js_handle_offer)

func _on_webrtc_answer(data) -> void:
	"""Handle WebRTC answer from another peer"""
	print("WebRTCVoiceManager: Received WebRTC answer from: ", data.fromSessionId)
	
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	
	# Convert answer to JSON string for safe JavaScript injection
	var json_answer = JSON.stringify(data.answer)
	var js_handle_answer = """
	(async function() {
		try {
			const fromSessionId = '""" + str(data.fromSessionId) + """';
			const answer = """ + json_answer + """;
			
			console.log('🎤 Handling WebRTC answer from:', fromSessionId);
			
			// Initialize WebRTC manager for listen-only mode if not already initialized
			if (!window.webrtcVoiceManager) {
				console.log('🎤 Initializing WebRTC voice manager for listen-only mode...');
				window.webrtcVoiceManager = {
					isEnabled: true,
					localStream: null,
					peerConnections: new Map()
				};
			}
			
			const voiceManager = window.webrtcVoiceManager;
			const pc = voiceManager.peerConnections.get(fromSessionId);
			
			if (pc) {
				await pc.setRemoteDescription(answer);
				console.log('✅ WebRTC answer handled successfully');
			} else {
				console.error('No peer connection found for:', fromSessionId);
			}
			
			return true;
			
		} catch (error) {
			console.error('❌ Error handling WebRTC answer:', error);
			return false;
		}
	})();
	"""
	
	JavaScriptBridge.eval(js_handle_answer)

func _on_webrtc_ice_candidate(data) -> void:
	"""Handle WebRTC ICE candidate from another peer"""
	print("WebRTCVoiceManager: Received ICE candidate from: ", data.fromSessionId)
	
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	
	# Convert candidate to JSON string for safe JavaScript injection
	var json_candidate = JSON.stringify(data.candidate)
	var js_handle_ice = """
	(async function() {
		try {
			const fromSessionId = '""" + str(data.fromSessionId) + """';
			const candidate = """ + json_candidate + """;
			
			console.log('🎤 Handling ICE candidate from:', fromSessionId);
			
			// Initialize WebRTC manager for listen-only mode if not already initialized
			if (!window.webrtcVoiceManager) {
				console.log('🎤 Initializing WebRTC voice manager for listen-only mode...');
				window.webrtcVoiceManager = {
					isEnabled: true,
					localStream: null,
					peerConnections: new Map()
				};
			}
			
			const voiceManager = window.webrtcVoiceManager;
			const pc = voiceManager.peerConnections.get(fromSessionId);
			
			if (pc) {
				await pc.addIceCandidate(candidate);
				console.log('✅ ICE candidate added successfully');
			} else {
				console.error('No peer connection found for:', fromSessionId);
			}
			
			return true;
			
		} catch (error) {
			console.error('❌ Error handling ICE candidate:', error);
			return false;
		}
	})();
	"""
	
	JavaScriptBridge.eval(js_handle_ice)

func _on_peer_joined(data) -> void:
	"""Handle new peer joining voice chat"""
	print("WebRTCVoiceManager: 🎤 Peer joined voice chat: ", data.sessionId)
	print("WebRTCVoiceManager: 🎤 My voice enabled: ", voice_enabled, " Platform: web=", OS.has_feature("web"))
	
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		print("WebRTCVoiceManager: ❌ Not on web platform or no JavaScriptBridge")
		return
	
	# Get my session ID to prevent self-connections
	var my_session_id = _get_my_session_id()
	if data.sessionId == my_session_id:
		print("WebRTCVoiceManager: 🎤 Ignoring self-connection to: ", data.sessionId)
		return
	
	# Store peer position
	if data.has("position"):
		player_positions[data.sessionId] = Vector2(data.position.x, data.position.y)
		print("WebRTCVoiceManager: 🎤 Stored position for ", data.sessionId, ": ", player_positions[data.sessionId])
	
	# Only talking players create offers to other players
	# Listening players wait for offers from talking players
	if voice_enabled:
		# Check if we already have a connection attempt for this peer
		if data.sessionId in peer_connections:
			print("WebRTCVoiceManager: 🎤 Connection already exists for peer: ", data.sessionId, " - skipping")
			return
		
		# Mark that we're creating a connection for this peer
		peer_connections[data.sessionId] = true
		print("WebRTCVoiceManager: 🎤 I'm talking - creating offer to send audio to peer: ", data.sessionId)
		_create_webrtc_offer_delayed(data.sessionId)
	else:
		print("WebRTCVoiceManager: 🎤 I'm listening - waiting for offers from talking players, not creating offer to: ", data.sessionId)

func _on_peer_left(data) -> void:
	"""Handle peer leaving voice chat"""
	print("WebRTCVoiceManager: Peer left voice chat: ", data.sessionId)
	
	# Remove peer connection
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	
	var js_remove_peer = """
	(function() {
		const sessionId = '""" + str(data.sessionId) + """';
		
		if (window.webrtcVoiceManager) {
			const voiceManager = window.webrtcVoiceManager;
			const pc = voiceManager.peerConnections.get(sessionId);
			
			if (pc) {
				pc.close();
				voiceManager.peerConnections.delete(sessionId);
				console.log('🎤 Removed peer connection for:', sessionId);
			}
		}
	})();
	"""
	
	JavaScriptBridge.eval(js_remove_peer)
	
	# Remove from positions and connections
	player_positions.erase(data.sessionId)
	peer_connections.erase(data.sessionId)

func _get_my_session_id() -> String:
	"""Get current player's session ID from room"""
	if not room:
		print("WebRTCVoiceManager: ❌ No room available for session ID")
		return ""
	
	print("WebRTCVoiceManager: 🔍 Debugging room object properties...")
	print("WebRTCVoiceManager: 🔍 Room type: ", typeof(room))
	print("WebRTCVoiceManager: 🔍 Room class: ", room.get_class() if room.has_method("get_class") else "unknown")
	
	# Try different ways to get session ID
	if room.has_method("get_session_id"):
		var session_id = room.get_session_id()
		print("WebRTCVoiceManager: 🎤 Got session ID via get_session_id(): ", session_id)
		return session_id
	
	# Try to access properties using get() method (Godot 4 compatible)
	if room.has_method("get"):
		var session_id = room.get("sessionId")
		if session_id != null:
			print("WebRTCVoiceManager: 🎤 Got session ID via get('sessionId'): ", session_id)
			return session_id
		
		session_id = room.get("session_id")
		if session_id != null:
			print("WebRTCVoiceManager: 🎤 Got session ID via get('session_id'): ", session_id)
			return session_id
	
	# Try direct property access (fallback)
	if "sessionId" in room:
		var session_id = room.sessionId
		print("WebRTCVoiceManager: 🎤 Got session ID via sessionId property: ", session_id)
		return session_id
	elif "session_id" in room:
		var session_id = room.session_id
		print("WebRTCVoiceManager: 🎤 Got session ID via session_id property: ", session_id)
		return session_id
	else:
		print("WebRTCVoiceManager: ❌ Could not retrieve session ID from room")
		if room.has_method("get_method_list"):
			print("WebRTCVoiceManager: 🔍 Available methods: ", room.get_method_list())
		else:
			print("WebRTCVoiceManager: 🔍 Available methods: unknown")
		return ""

func _wait_for_mic_ready_and_create_offers() -> void:
	"""Wait for microphone to be ready, then create offers to all players"""
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	
	var js_wait_for_mic = """
	(async function() {
		console.log('🎤 Checking if microphone is ready...');
		
		// Wait for webrtcVoiceManager to be initialized and have local stream
		var attempts = 0;
		var maxAttempts = 20; // 2 seconds max wait
		
		while (attempts < maxAttempts) {
			if (window.webrtcVoiceManager && 
				window.webrtcVoiceManager.localStream && 
				window.webrtcVoiceManager.localStream.getAudioTracks().length > 0 &&
				window.webrtcVoiceManager.localStream.getAudioTracks()[0].readyState === 'live') {
				console.log('✅ Microphone is ready!');
				return true;
			}
			
			console.log('⏳ Waiting for microphone... attempt', attempts + 1);
			await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
			attempts++;
		}
		
		console.log('❌ Microphone failed to become ready within 2 seconds');
		return false;
	})();
	"""
	
	var mic_ready = JavaScriptBridge.eval(js_wait_for_mic)
	if mic_ready:
		print("WebRTCVoiceManager: ✅ Microphone confirmed ready, creating offers...")
		microphone_ready_changed.emit(true)  # Signal that mic is ready
		_create_offers_to_all_players()
	else:
		print("WebRTCVoiceManager: ⚠️ Microphone not ready, retrying in 1 second...")
		await get_tree().create_timer(1.0).timeout
		microphone_ready_changed.emit(true)  # Signal ready even if fallback
		_create_offers_to_all_players()

# All talking indicator functions removed

func _create_offers_to_all_players() -> void:
	"""Create WebRTC offers to all players in player_positions"""
	print("WebRTCVoiceManager: 🎤 _create_offers_to_all_players() CALLED!")
	print("WebRTCVoiceManager: 🎤 Voice enabled: ", voice_enabled)
	print("WebRTCVoiceManager: 🎤 Room exists: ", room != null)
	
	if not voice_enabled:
		print("WebRTCVoiceManager: ❌ Voice not enabled, not creating offers")
		return
		
	var my_session_id = _get_my_session_id()
	print("WebRTCVoiceManager: 🎤 Creating offers to all players. My session: ", my_session_id)
	print("WebRTCVoiceManager: 🎤 Known players: ", player_positions.keys())
	print("WebRTCVoiceManager: 🎤 Total known players: ", player_positions.size())
	print("WebRTCVoiceManager: 🎤 Existing peer connections: ", peer_connections.keys())
	
	if player_positions.size() == 0:
		print("WebRTCVoiceManager: ⚠️ No players in player_positions! This might be why voice chat isn't working.")
		print("WebRTCVoiceManager: ⚠️ Make sure listening players are being tracked in player_positions.")
		return
	
	var offers_created = 0
	for session_id in player_positions.keys():
		print("WebRTCVoiceManager: 🎤 Checking player: ", session_id)
		
		# Skip self-connections (only if we successfully got session ID)
		if my_session_id != "" and session_id == my_session_id:
			print("WebRTCVoiceManager: 🎤 Skipping self-connection to: ", session_id)
			continue
			
		# Skip if connection already exists
		if session_id in peer_connections:
			print("WebRTCVoiceManager: 🎤 Connection already exists to: ", session_id)
			continue
			
		print("WebRTCVoiceManager: 🎤 Creating offer to: ", session_id)
		peer_connections[session_id] = true
		_create_webrtc_offer_delayed(session_id)
		offers_created += 1
		
	print("WebRTCVoiceManager: 🎤 Total offers created: ", offers_created)

func _initialize_audio_context_for_listening() -> void:
	"""Initialize audio context for listening without requesting microphone"""
	print("WebRTCVoiceManager: Initializing audio context for listening...")
	
	if not OS.has_feature("web"):
		print("WebRTCVoiceManager: ❌ WebRTC voice chat only supported on web platform")
		return
	
	if not Engine.has_singleton("JavaScriptBridge"):
		print("WebRTCVoiceManager: ❌ JavaScriptBridge not available")
		return
	
	# Initialize audio context only (no microphone access needed for listening)
	var js_init_listening = """
	(async function() {
		console.log('🎧 Initializing audio context for listening...');
		
		try {
			// Initialize if not already done
			if (!window.webrtcVoiceManager) {
				window.webrtcVoiceManager = {
					localStream: null,
					peerConnections: new Map(),
					audioContext: null,
					isEnabled: false
				};
			}
			
			const voiceManager = window.webrtcVoiceManager;
			
			// Create audio context for proximity volume control (no microphone needed)
			if (!voiceManager.audioContext) {
				voiceManager.audioContext = new (window.AudioContext || window.webkitAudioContext)();
				console.log('✅ Audio context created for listening, state:', voiceManager.audioContext.state);
			}
			
			// Resume audio context if suspended (required for audio playback)
			if (voiceManager.audioContext.state === 'suspended') {
				// User interaction is required to resume audio context
				console.log('🎧 Audio context is suspended - will resume on user interaction');
				
				// Add event listeners to resume audio context on user interaction
				const resumeAudioContext = async () => {
					try {
						await voiceManager.audioContext.resume();
						console.log('✅ Audio context resumed for listening, state:', voiceManager.audioContext.state);
					} catch (error) {
						console.error('❌ Failed to resume audio context:', error);
					}
				};
				
				document.addEventListener('click', resumeAudioContext, { once: true });
				document.addEventListener('keydown', resumeAudioContext, { once: true });
				document.addEventListener('touchstart', resumeAudioContext, { once: true });
			}
			
			voiceManager.isEnabled = true;
			console.log('✅ Audio context initialized for listening');
			
			// Set up helper functions
			""" + _get_webrtc_helper_functions() + """
			
			return true;
			
		} catch (error) {
			console.error('❌ Failed to initialize audio context for listening:', error);
			return false;
		}
	})();
	"""
	
	JavaScriptBridge.eval(js_init_listening)
	print("WebRTCVoiceManager: ✅ Audio context initialization for listening started")

func _join_voice_chat_for_listening() -> void:
	"""Automatically join voice chat for listening, even without microphone"""
	if not room:
		return
	
	print("WebRTCVoiceManager: 🎤 Auto-joining voice chat for listening...")
	
	# Initialize audio context first (without microphone)
	_initialize_audio_context_for_listening()
	
	# Send join message to get list of current voice chat participants
	room.send("voice_chat_join", {})
	print("WebRTCVoiceManager: 🎤 Auto-join message sent for listening")

func _on_peers_list(data) -> void:
	"""Handle list of current voice chat peers"""
	print("WebRTCVoiceManager: Received peers list: ", data.peers.size(), " peers")
	print("WebRTCVoiceManager: 🎤 Creating connections to listen to peers (my mic enabled: ", voice_enabled, ")")
	
	# Get my session ID to prevent self-connections
	var my_session_id = _get_my_session_id()
	print("WebRTCVoiceManager: 🎤 My session ID: ", my_session_id)
	
	# Store peer positions and create offers for all peers
	for peer in data.peers:
		if peer.has("position"):
			player_positions[peer.sessionId] = Vector2(peer.position.x, peer.position.y)
		
		# Skip self-connections
		if peer.sessionId == my_session_id:
			print("WebRTCVoiceManager: 🎤 Ignoring self-connection to: ", peer.sessionId)
			continue
		
		# Only talking players create offers to other players
		# Listening players wait for offers from talking players
		if voice_enabled:
			# Check if we already have a connection attempt for this peer
			if peer.sessionId in peer_connections:
				print("WebRTCVoiceManager: 🎤 Connection already exists for existing peer: ", peer.sessionId, " - skipping")
				continue
			
			# Mark that we're creating a connection for this peer
			peer_connections[peer.sessionId] = true
			print("WebRTCVoiceManager: 🎤 I'm talking - creating offer to send audio to existing peer: ", peer.sessionId)
			_create_webrtc_offer_delayed(peer.sessionId)
		else:
			print("WebRTCVoiceManager: 🎤 I'm listening - waiting for offers from talking players, not creating offer to: ", peer.sessionId)

func on_voice_zone_changed() -> void:
	"""Handle voice zone changes - reconnect to appropriate peers based on new zone"""
	print("WebRTCVoiceManager: 🎤 Voice zone changed - reconnecting to appropriate peers")
	
	if not room:
		print("WebRTCVoiceManager: ❌ No room available for zone change")
		return
	
	# Close all existing peer connections since we're changing voice zones
	_cleanup_all_peer_connections()
	
	# Re-join voice chat to get new peer list based on current voice zone
	print("WebRTCVoiceManager: 🎤 Rejoining voice chat for new zone...")
	room.send("voice_chat_join", {})

func _cleanup_all_peer_connections() -> void:
	"""Close and clean up all existing peer connections"""
	print("WebRTCVoiceManager: 🧹 Cleaning up all peer connections for zone change")
	
	for session_id in peer_connections.keys():
		var peer_data = peer_connections[session_id]
		if typeof(peer_data) == TYPE_DICTIONARY:
			if "peer_connection" in peer_data and peer_data.peer_connection != null:
				print("WebRTCVoiceManager: 🧹 Closing connection to: ", session_id)
				if peer_data.peer_connection.has_method("close"):
					peer_data.peer_connection.close()
	
	# Clear all connections
	peer_connections.clear()
	print("WebRTCVoiceManager: 🧹 All peer connections cleaned up")

func _create_webrtc_offer_delayed(target_session_id: String) -> void:
	"""Create WebRTC offer with delay to ensure initialization completes"""
	print("WebRTCVoiceManager: Scheduling delayed WebRTC offer for: ", target_session_id)
	
	# Add to pending offers and start timer
	pending_offers.append(target_session_id)
	print("WebRTCVoiceManager: Added to pending offers. Total pending: ", pending_offers.size())
	
	if offer_timer and not offer_timer.is_stopped():
		print("WebRTCVoiceManager: Stopping existing timer")
		offer_timer.stop()
	if offer_timer:
		print("WebRTCVoiceManager: Starting timer for 0.5 seconds")
		offer_timer.start()
	else:
		print("WebRTCVoiceManager: ❌ Timer is null!")

func _process_pending_offers() -> void:
	"""Process all pending WebRTC offers"""
	print("WebRTCVoiceManager: Processing ", pending_offers.size(), " pending offers")
	for session_id in pending_offers:
		_create_webrtc_offer(session_id)
	pending_offers.clear()

func _create_webrtc_offer(target_session_id: String) -> void:
	"""Create and send WebRTC offer to target peer"""
	print("WebRTCVoiceManager: Creating WebRTC offer for: ", target_session_id)
	
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	
	var js_create_offer = """
	(async function() {
		try {
			const targetSessionId = '""" + target_session_id + """';
			
			console.log('🎤 Creating WebRTC offer for:', targetSessionId);
			
			// Initialize voice manager if not already done (for listen-only mode)
			if (!window.webrtcVoiceManager) {
				console.log('🎤 Initializing WebRTC voice manager for listen-only mode...');
				window.webrtcVoiceManager = {
					localStream: null,
					peerConnections: new Map(),
					audioContext: null,
					isEnabled: false
				};
			}
			
			const voiceManager = window.webrtcVoiceManager;
			
			// Check if connection already exists or is being created
			if (voiceManager.peerConnections.has(targetSessionId)) {
				console.log('🎤 Connection already exists for:', targetSessionId, '- skipping offer creation');
				return;
			}
			
			// Create peer connection
			const pc = new RTCPeerConnection({
				iceServers: [
					{ urls: 'stun:stun.l.google.com:19302' },
					{ urls: 'stun:stun1.l.google.com:19302' }
				]
			});
			
			// Store peer connection immediately to prevent duplicates
			voiceManager.peerConnections.set(targetSessionId, pc);
			console.log('🎤 Connection stored for:', targetSessionId);
			
			// Add local stream
			if (voiceManager.localStream) {
				console.log('🎤 Adding local stream tracks to peer connection');
				voiceManager.localStream.getTracks().forEach(track => {
					console.log('🎤 Adding track:', track.kind, 'enabled:', track.enabled);
					pc.addTrack(track, voiceManager.localStream);
				});
			} else {
				console.log('🎤 No local stream - creating listen-only connection');
			}
			
			// Handle remote stream
			pc.ontrack = (event) => {
				console.log('🎤 Received remote stream from:', targetSessionId);
				const remoteStream = event.streams[0];
				window.handleRemoteAudioStream(targetSessionId, remoteStream);
			};
			
			// Handle ICE candidates
			pc.onicecandidate = (event) => {
				if (event.candidate) {
					console.log('🎤 Sending ICE candidate to:', targetSessionId);
					window.sendICECandidate(targetSessionId, event.candidate);
				}
			};
			
			// Create and send offer
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			
			// Send offer
			window.sendWebRTCOffer(targetSessionId, offer);
			
			console.log('✅ WebRTC offer created and sent');
			return true;
			
		} catch (error) {
			console.error('❌ Error creating WebRTC offer:', error);
			return false;
		}
	})();
	"""
	
	# Set up helper functions
	_setup_webrtc_helpers()
	
	JavaScriptBridge.eval(js_create_offer)

func _setup_javascript_room_bridge() -> void:
	"""Set up JavaScript bridge to Colyseus room for WebRTC signaling"""
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	
	var js_bridge_setup = """
	// Set up bridge between WebRTC and Colyseus room
	if (window.godotColyseusRoom) {
		window.colyseusRoom = window.godotColyseusRoom;
		console.log('✅ Colyseus room bridge established for WebRTC');
	} else {
		console.log('⚠️ Waiting for Colyseus room to be available...');
		// Set up a check for when the room becomes available
		const checkForRoom = setInterval(() => {
			if (window.godotColyseusRoom) {
				window.colyseusRoom = window.godotColyseusRoom;
				console.log('✅ Colyseus room bridge established for WebRTC (delayed)');
				clearInterval(checkForRoom);
			}
		}, 100);
		
		// Stop checking after 10 seconds
		setTimeout(() => {
			clearInterval(checkForRoom);
			if (!window.colyseusRoom) {
				console.error('❌ Failed to establish Colyseus room bridge for WebRTC');
			}
		}, 10000);
	}
	"""
	
	JavaScriptBridge.eval(js_bridge_setup)

func _setup_webrtc_helpers() -> void:
	"""Set up JavaScript helper functions for WebRTC communication"""
	var js_helpers = """
	// Helper functions for WebRTC communication with Godot
	window.sendWebRTCOffer = function(targetSessionId, offer) {
		// This will be called by JavaScript to send offers back to Godot
		if (window.godotWebRTCManager) {
			window.godotWebRTCManager.sendOffer(targetSessionId, offer);
		}
	};
	
	window.sendWebRTCAnswer = function(targetSessionId, answer) {
		// This will be called by JavaScript to send answers back to Godot
		if (window.godotWebRTCManager) {
			window.godotWebRTCManager.sendAnswer(targetSessionId, answer);
		}
	};
	
	window.sendICECandidate = function(targetSessionId, candidate) {
		// This will be called by JavaScript to send ICE candidates back to Godot
		if (window.godotWebRTCManager) {
			window.godotWebRTCManager.sendICECandidate(targetSessionId, candidate);
		}
	};
	
	// Audio level monitoring function removed
	
	window.handleRemoteAudioStream = function(sessionId, stream) {
		// Handle incoming audio stream with proximity volume
		console.log('🎤 Setting up remote audio stream for:', sessionId);
		console.log('🎤 Stream tracks:', stream.getTracks().length);
		
		// Store for volume control
		if (!window.remoteAudioStreams) {
			window.remoteAudioStreams = new Map();
		}
		
		// Simple approach: Use HTML audio element for reliable playback
		const audio = new Audio();
		audio.srcObject = stream;
		audio.autoplay = true;
		audio.volume = 1.0; // Start at full volume
		audio.muted = false;
		
		// Add event listeners for debugging
		audio.onloadedmetadata = () => {
			console.log('✅ Audio metadata loaded for:', sessionId);
		};
		audio.onplay = () => {
			console.log('✅ Audio playback started for:', sessionId);
		};
		audio.onerror = (e) => {
			console.error('❌ Audio error for:', sessionId, e);
		};
		
		// Try to play audio, handle autoplay restrictions
		const tryPlay = () => {
			audio.play().then(() => {
				console.log('✅ Audio play() succeeded for:', sessionId);
			}).catch(error => {
				if (error.name === 'NotAllowedError') {
					console.log('🎤 Audio autoplay blocked for:', sessionId, '- will play on next user interaction');
					// Add click listener to resume audio on user interaction
					const enableAudio = () => {
						audio.play().then(() => {
							console.log('✅ Audio resumed after user interaction for:', sessionId);
						}).catch(e => console.error('❌ Failed to resume audio:', e));
					};
					document.addEventListener('click', enableAudio, { once: true });
					document.addEventListener('keydown', enableAudio, { once: true });
				} else {
					console.error('❌ Audio play() failed for:', sessionId, error);
				}
			});
		};
		
		tryPlay();
		
		// Audio level monitoring removed
		
		// Store the audio element
		window.remoteAudioStreams.set(sessionId, {
			audio: audio,
			stream: stream,
			volume: 1.0
		});
		
		// Notify Godot about the new stream
		if (window.godotWebRTCManager) {
			window.godotWebRTCManager.onRemoteStreamReceived(sessionId);
		}
		
		console.log('✅ Remote audio stream setup complete for:', sessionId);
	};
	
	window.setRemoteAudioVolume = function(sessionId, volume) {
		// Set volume for remote audio stream
		if (window.remoteAudioStreams && window.remoteAudioStreams.has(sessionId)) {
			const streamData = window.remoteAudioStreams.get(sessionId);
			const clampedVolume = Math.max(0, Math.min(1, volume));
			streamData.audio.volume = clampedVolume;
			streamData.volume = clampedVolume;
			console.log('🔊 Set volume for', sessionId, 'to', clampedVolume);
		}
	};
	
	// Set up the bridge
	window.godotWebRTCManager = {
		sendOffer: function(targetSessionId, offer) {
			// Send offer through Colyseus
			if (window.godotColyseusRoom) {
				window.godotColyseusRoom.send("webrtc_offer", {
					targetSessionId: targetSessionId,
					offer: offer
				});
			}
		},
		sendAnswer: function(targetSessionId, answer) {
			// Send answer through Colyseus
			if (window.godotColyseusRoom) {
				window.godotColyseusRoom.send("webrtc_answer", {
					targetSessionId: targetSessionId,
					answer: answer
				});
			}
		},
		sendICECandidate: function(targetSessionId, candidate) {
			// Send ICE candidate through Colyseus
			if (window.godotColyseusRoom) {
				window.godotColyseusRoom.send("webrtc_ice_candidate", {
					targetSessionId: targetSessionId,
					candidate: candidate
				});
			}
		},
		onRemoteStreamReceived: function(sessionId) {
			// Notify Godot that we received a remote stream
			console.log('Remote stream received notification for:', sessionId);
		},
		// onPlayerTalkingChanged function removed
	};
	
	console.log('✅ WebRTC helper functions set up');
	"""
	
	JavaScriptBridge.eval(js_helpers)

func update_local_player_position(position: Vector2) -> void:
	"""Update local player position for proximity calculations"""
	local_player_position = position

func update_player_position(session_id: String, position: Vector2) -> void:
	"""Update another player's position"""
	player_positions[session_id] = position
	
	# Update proximity volume for all players when voice chat is active
	# (This affects how loud you hear others, regardless of whether your mic is on)
	_update_proximity_volume(session_id)

func _update_proximity_volume(session_id: String) -> void:
	"""Update proximity volume for a player"""
	if not player_positions.has(session_id):
		return
	
	var player_pos = player_positions[session_id]
	var distance = local_player_position.distance_to(player_pos)
	var volume = _calculate_proximity_volume(distance)
	
	# Update volume in browser
	if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
		var js_update_volume = """
		if (window.setRemoteAudioVolume) {
			window.setRemoteAudioVolume('""" + session_id + """', """ + str(volume) + """);
		} else {
			console.log('⚠️ setRemoteAudioVolume not available yet for:', '""" + session_id + """');
		}
		"""
		JavaScriptBridge.eval(js_update_volume)
	
	# Emit signal for UI updates
	proximity_volume_changed.emit(session_id, volume)

func _get_webrtc_helper_functions() -> String:
	"""Get JavaScript helper functions for WebRTC"""
	return """
	window.setRemoteAudioVolume = function(sessionId, volume) {
		// Set volume for remote audio stream
		if (window.remoteAudioStreams && window.remoteAudioStreams.has(sessionId)) {
			const streamData = window.remoteAudioStreams.get(sessionId);
			const clampedVolume = Math.max(0, Math.min(1, volume));
			streamData.audio.volume = clampedVolume;
			streamData.volume = clampedVolume;
			console.log('🔊 Set volume for', sessionId, 'to', clampedVolume);
		}
	};
	console.log('✅ WebRTC helper functions set up');
	"""

func _calculate_proximity_volume(distance: float) -> float:
	"""Calculate volume based on distance (0.0 to 1.0)"""
	if distance > proximity_range:
		return 0.0
	
	# Simple linear falloff for now
	return 1.0 - (distance / proximity_range)

func debug_voice_chat_state() -> Dictionary:
	"""Get debug information about voice chat state"""
	return {
		"voice_enabled": voice_enabled,
		"is_recording": is_recording,
		"has_room": room != null,
		"player_positions_count": player_positions.size(),
		"local_position": local_player_position,
		"proximity_range": proximity_range
	}

# Compatibility function for legacy code
func play_voice_data(_audio_bytes: PackedByteArray, _volume: float = 1.0) -> void:
	"""Compatibility function - WebRTC handles audio automatically"""
	# This function is kept for compatibility but does nothing
	# since WebRTC handles audio streaming automatically
	pass
