# res://scripts/LiveKitVoiceManager.gd
# LiveKit Voice Chat Manager - Lightweight SFU solution
extends Node

signal voice_chat_enabled_changed(enabled: bool)
signal microphone_ready_changed(is_ready: bool)

# Voice chat state
var voice_enabled := false
var is_recording := false

# Colyseus room reference
var room: Object = null
var main_net_client: Node = null

# LiveKit state
var livekit_room: Object = null
var current_voice_room: String = "lobby"

func _ready() -> void:
	add_to_group("voice_chat")
	_initialize_livekit_client()

func _initialize_livekit_client():
	"""Initialize LiveKit client using lightweight SDK"""
	if not OS.has_feature("web"):
		return
	
	var js_init = """
	(async function() {
		console.log('🎙️ Initializing LiveKit client...');
		
		// Check if LiveKit client library is available
		if (typeof window.LiveKitRoom === 'undefined') {
			console.log('📦 Loading LiveKit client library dynamically...');
			
			// Load LiveKit client SDK (much smaller than mediasoup-client)
			const script = document.createElement('script');
			script.src = 'https://unpkg.com/livekit-client@2.12.0/dist/livekit-client.umd.js';
			script.onload = () => {
				console.log('✅ LiveKit client loaded successfully');
				window.godotLiveKitReady = true;
			};
			script.onerror = () => {
				console.error('❌ Failed to load LiveKit client');
				window.godotLiveKitReady = false;
			};
			document.head.appendChild(script);
			
			// Wait for library to load
			let attempts = 0;
			while (!window.godotLiveKitReady && attempts < 50) {
				await new Promise(resolve => setTimeout(resolve, 100));
				attempts++;
			}
			
			if (!window.godotLiveKitReady) {
				console.error('❌ LiveKit client failed to load after 5 seconds');
				return false;
			}
		} else {
			console.log('✅ LiveKit client already available (preloaded)');
			console.log('Available LiveKit objects:', Object.keys(window).filter(k => k.includes('LiveKit')));
			console.log('LiveKit namespace:', typeof window.LiveKit);
			window.godotLiveKitReady = true;
		}
		
		console.log('✅ LiveKit client ready!');
		return true;
	})();
	"""
	
	JavaScriptBridge.eval(js_init)

func set_room(new_room: Object) -> void:
	"""Set the Colyseus room reference"""
	room = new_room
	
	if room:
		_setup_livekit_handlers()
		# Auto-join LiveKit room for listen-only mode
		_join_for_listening()

func set_main_net_client(client: Node) -> void:
	"""Set the main network client reference"""
	main_net_client = client

func _setup_livekit_handlers() -> void:
	"""Setup LiveKit-specific message handlers"""
	if not room:
		return
	
	# Listen for LiveKit tokens from server
	room.on_message("livekit_token").on(Callable(self, "_on_livekit_token_received"))
	room.on_message("livekit_error").on(Callable(self, "_on_livekit_error_received"))

func _join_for_listening() -> void:
	"""Join LiveKit room for listen-only mode (without microphone)"""
	# Check if already connected
	if OS.has_feature("web"):
		var js_check_connection = """
		(function() {
			return window.godotLiveKitRoom && window.godotLiveKitRoom.state === 'connected';
		})();
		"""
		var already_connected = JavaScriptBridge.eval(js_check_connection)
		if already_connected:
			return
	
	# Request token for listen-only access (without microphone)
	if room:
		# Set voice_enabled to false for listen-only mode
		voice_enabled = false
		is_recording = false
		room.send("get_livekit_token", {"roomName": current_voice_room})

func _on_livekit_error_received(data) -> void:
	"""Handle LiveKit error from server"""
	print("LiveKitVoiceManager: ❌ LiveKit error: ", data.error)

func _on_livekit_token_received(data) -> void:
	"""Handle LiveKit token received from server"""
	
	var js_connect = """
	(async function() {
		try {
			// Wait for the library to fully initialize
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			// Try to find the correct Room class from the loaded module
			let RoomClass = null;
			
			// Check common LiveKit UMD export patterns (found 'LivekitClient' in window!)
			const possiblePaths = [
				'LivekitClient.Room',
				'LivekitClient.RoomClient', 
				'LivekitClient.LiveKitRoom',
				'LiveKitRoom',
				'LiveKit.Room', 
				'livekit.Room',
				'window.LiveKitRoom',
				'LiveKit_Room',
				'LiveKitCore.Room'
			];
			
			for (const path of possiblePaths) {
				try {
					const parts = path.split('.');
					let obj = window;
					for (const part of parts) {
						if (part === 'window') continue;
						obj = obj[part];
						if (!obj) break;
					}
					if (obj && typeof obj === 'function') {
						RoomClass = obj;
						break;
					}
				} catch (e) {
					// Continue to next path
				}
			}
			
			// If still not found, try dynamic import fallback
			if (!RoomClass) {
				console.log('🔄 Attempting dynamic import...');
				try {
					const livekit = await import('https://unpkg.com/livekit-client@2.12.0/dist/livekit-client.esm.js');
					RoomClass = livekit.Room;
					console.log('✅ Got Room class from dynamic import');
				} catch (importError) {
					console.error('❌ Dynamic import failed:', importError);
				}
			}
			
			if (!RoomClass) {
				throw new Error('LiveKit Room class not found after all attempts. Available objects: ' + Object.keys(window).filter(k => k.toLowerCase().includes('live') || k.toLowerCase().includes('kit') || k.toLowerCase().includes('room')));
			}
			
			// Create or get existing room
			if (!window.godotLiveKitRoom) {
				
				console.log('✅ Using Room class:', RoomClass);
				window.godotLiveKitRoom = new RoomClass();
				
				// Initialize audio element storage
				if (!window.livekitAudioElements) {
					window.livekitAudioElements = new Map();
				}
				
				// Setup event listeners with error handling
				window.godotLiveKitRoom.on('trackSubscribed', (track, publication, participant) => {
					
					if (track.kind === 'audio') {
						try {
							// Create unique audio element for this participant
							const audioId = 'livekit-audio-' + participant.identity;
							
							// Remove existing audio element if it exists
							if (window.livekitAudioElements.has(participant.identity)) {
								const oldElement = window.livekitAudioElements.get(participant.identity);
								oldElement.pause();
								oldElement.remove();
							}
							
						const audioElement = document.createElement('audio');
							audioElement.id = audioId;
						audioElement.srcObject = new MediaStream([track.mediaStreamTrack]);
						audioElement.autoplay = true;
							audioElement.volume = 1.0;
							audioElement.controls = false; // Hide controls
							audioElement.style.display = 'none'; // Hide element but keep functional
							
							// Add debug event listeners
							audioElement.oncanplay = () => {
							};
							audioElement.onplay = () => {
							};
							audioElement.onerror = (e) => {
								console.error('❌ Audio error for', participant.identity, e);
							};
							audioElement.onended = () => {
							};
							
							// Handle autoplay restrictions
							const playPromise = audioElement.play();
							if (playPromise !== undefined) {
								playPromise.then(() => {
								}).catch(error => {
									console.warn('⚠️ Audio autoplay blocked for', participant.identity, '- will resume on user interaction');
									// Add user interaction handlers to resume audio
									const resumeAudio = () => {
										audioElement.play().then(() => {
											console.log('✅ Audio resumed after user interaction for', participant.identity);
										}).catch(e => console.error('❌ Failed to resume audio:', e));
									};
									document.addEventListener('click', resumeAudio, { once: true });
									document.addEventListener('keydown', resumeAudio, { once: true });
								});
							}
							
							// Add to DOM and store reference
						document.body.appendChild(audioElement);
							window.livekitAudioElements.set(participant.identity, audioElement);
							
							console.log('✅ Audio element created and stored for', participant.identity);
						} catch (audioError) {
							console.error('❌ Failed to create audio element for', participant.identity, ':', audioError);
						}
					}
				});
				
				// Handle track published (when remote participant starts their audio)
				window.godotLiveKitRoom.on('trackPublished', (trackPub, participant) => {
					console.log('📤 Track published by', participant.identity, 'kind:', trackPub.kind);
					console.log('📤 Track details:', {
						trackSid: trackPub.trackSid,
						trackName: trackPub.trackName,
						source: trackPub.source,
						enabled: trackPub.enabled,
						subscribed: trackPub.isSubscribed
					});
					
					if (trackPub.kind === 'audio') {
						console.log('🎤 Audio track published, forcing subscription...');
						// Always force subscription to audio tracks for listen-only functionality
						try {
							trackPub.setSubscribed(true);
							console.log('✅ Forced subscription to audio track from', participant.identity);
							
							// Double-check subscription status
							setTimeout(() => {
								console.log('🔍 Subscription check for', participant.identity, '- subscribed:', trackPub.isSubscribed);
							}, 1000);
						} catch (subscribeError) {
							console.error('❌ Failed to subscribe to track:', subscribeError);
						}
					}
				});
				
				// Handle track unpublished (when remote participant stops publishing)
				window.godotLiveKitRoom.on('trackUnpublished', (trackPub, participant) => {
					console.log('📤❌ Track unpublished by', participant.identity, 'kind:', trackPub.kind);
				});
				
				// Handle track unsubscribed (when remote participant stops their audio)
				window.godotLiveKitRoom.on('trackUnsubscribed', (track, publication, participant) => {
					console.log('🔇 Track unsubscribed from', participant.identity, 'kind:', track.kind);
					
					if (track.kind === 'audio' && window.livekitAudioElements.has(participant.identity)) {
						const audioElement = window.livekitAudioElements.get(participant.identity);
						audioElement.pause();
						audioElement.remove();
						window.livekitAudioElements.delete(participant.identity);
						console.log('🧹 Cleaned up audio element for', participant.identity);
					}
				});
				
				window.godotLiveKitRoom.on('participantConnected', (participant) => {
					console.log('👥 Participant connected:', participant.identity);
					if (window.godotLiveKitRoom.participants) {
						console.log('👥 Room now has participants:', Array.from(window.godotLiveKitRoom.participants.keys()));
					} else {
						console.log('👥 Room participants not available yet');
					}
					
					// Subscribe to all existing audio tracks from this participant
					const subscribeToExistingTracks = () => {
						console.log('🔍 Checking for existing tracks from:', participant.identity);
						if (participant.audioTracks) {
							participant.audioTracks.forEach((trackPub, trackSid) => {
							console.log('🎵 Found existing audio track:', trackSid, 'subscribed:', trackPub.isSubscribed);
							if (!trackPub.isSubscribed) {
								console.log('🔄 Subscribing to existing audio track from:', participant.identity);
								try {
									trackPub.setSubscribed(true);
									console.log('✅ Successfully subscribed to existing track');
								} catch (subscribeError) {
									console.error('❌ Failed to subscribe to existing track:', subscribeError);
								}
							} else {
								console.log('✅ Track already subscribed');
							}
						});
						} else {
							console.log('🔍 No audio tracks available yet for participant:', participant.identity);
						}
					};
					
					// Subscribe immediately and also after a delay to catch any tracks that aren't ready yet
					subscribeToExistingTracks();
					setTimeout(subscribeToExistingTracks, 1000);
					setTimeout(subscribeToExistingTracks, 3000); // Extra delay for reliability
				});
				
				window.godotLiveKitRoom.on('participantDisconnected', (participant) => {
					console.log('👋 Participant disconnected:', participant.identity);
					if (window.godotLiveKitRoom.participants) {
						console.log('👋 Room now has participants:', Array.from(window.godotLiveKitRoom.participants.keys()));
					} else {
						console.log('👋 Room participants not available');
					}
					
					// Clean up audio elements for disconnected participant
					if (window.livekitAudioElements && window.livekitAudioElements.has(participant.identity)) {
						const audioElement = window.livekitAudioElements.get(participant.identity);
						audioElement.pause();
						audioElement.remove();
						window.livekitAudioElements.delete(participant.identity);
						console.log('🧹 Cleaned up audio element for disconnected participant:', participant.identity);
					}
				});
				
				// Handle connection state changes
				window.godotLiveKitRoom.on('connectionStateChanged', (state) => {
					console.log('🔗 Connection state changed:', state);
				});
				
				// Handle DataChannel errors specifically
				window.godotLiveKitRoom.on('dataChannelError', (error) => {
					console.warn('⚠️ DataChannel error (non-critical):', error);
					// These errors are often non-critical for audio-only scenarios
				});
				
				// Handle disconnection
				window.godotLiveKitRoom.on('disconnected', (reason) => {
					console.log('📤 Disconnected from room:', reason);
					window.godotMicrophoneReady = false;
					
					// Clean up all audio elements on disconnection
					if (window.livekitAudioElements) {
						console.log('🧹 Cleaning up all audio elements on disconnect...');
						window.livekitAudioElements.forEach((audioElement, participantId) => {
							audioElement.pause();
							audioElement.remove();
							console.log('🧹 Cleaned up audio for:', participantId);
						});
						window.livekitAudioElements.clear();
					}
				});
				
				// Add global cleanup function
				window.cleanupLiveKitAudio = function() {
					if (window.livekitAudioElements) {
						console.log('🧹 Manual cleanup of all LiveKit audio elements...');
						window.livekitAudioElements.forEach((audioElement, participantId) => {
							audioElement.pause();
							audioElement.remove();
						});
						window.livekitAudioElements.clear();
					}
				};
				
				// Add function to manually resume all audio (for autoplay restrictions)
				window.resumeAllLiveKitAudio = function() {
					if (window.livekitAudioElements) {
						console.log('🔊 Manually resuming all LiveKit audio elements...');
						window.livekitAudioElements.forEach((audioElement, participantId) => {
							audioElement.play().then(() => {
								console.log('✅ Resumed audio for:', participantId);
							}).catch(error => {
								console.warn('⚠️ Could not resume audio for:', participantId, error);
							});
						});
					}
				};
				
				// Add click listener to resume audio on any user interaction
				document.addEventListener('click', window.resumeAllLiveKitAudio, { once: true });
				document.addEventListener('keydown', window.resumeAllLiveKitAudio, { once: true });
				
				// Add function to force subscription to all remote tracks (for listen-only functionality)
				window.subscribeToAllRemoteTracks = function() {
					if (!window.godotLiveKitRoom) {
						console.log('❌ No LiveKit room available');
						return;
					}
					
					if (!window.godotLiveKitRoom.participants) {
						console.log('❌ No remote participants available');
						return;
					}
					
					console.log('🔄 Force subscribing to all remote audio tracks...');
					let trackCount = 0;
					let subscriptionCount = 0;
					
					window.godotLiveKitRoom.participants.forEach((participant, identity) => {
						console.log('🔍 Checking participant:', identity);
						if (participant.audioTracks) {
							participant.audioTracks.forEach((trackPub, trackSid) => {
								trackCount++;
								console.log('🎵 Found track:', trackSid, 'from:', identity, 'subscribed:', trackPub.isSubscribed);
								
								if (!trackPub.isSubscribed) {
									try {
										trackPub.setSubscribed(true);
										subscriptionCount++;
										console.log('✅ Subscribed to track from:', identity);
									} catch (error) {
										console.error('❌ Failed to subscribe to track from:', identity, error);
									}
								}
							});
						} else {
							console.log('🔍 No audio tracks for participant:', identity);
						}
					});
					
					console.log(`📊 Found ${trackCount} remote tracks, subscribed to ${subscriptionCount} new tracks`);
				};
				
				// Add comprehensive audio debugging function
				window.debugLiveKitAudio = function() {
					console.log('=== LIVEKIT AUDIO DEBUG ===');
					
					if (!window.godotLiveKitRoom) {
						console.log('❌ No LiveKit room available');
						return;
					}
					
					console.log('🏠 Room state:', window.godotLiveKitRoom.state);
					console.log('🏠 Room name:', window.godotLiveKitRoom.name);
					
					// Local participant info
					if (window.godotLiveKitRoom.localParticipant) {
						const local = window.godotLiveKitRoom.localParticipant;
						console.log('👤 Local participant:', local.identity);
						console.log('🎤 Local audio tracks:', local.audioTracks.size);
						local.audioTracks.forEach((trackPub, sid) => {
							console.log('  🎵 Local track:', sid, {
								muted: trackPub.isMuted,
								enabled: trackPub.track?.enabled,
								kind: trackPub.track?.kind,
								readyState: trackPub.track?.readyState
							});
						});
					}
					
					// Remote participants info
					console.log('👥 Remote participants:', window.godotLiveKitRoom.participants.size);
					window.godotLiveKitRoom.participants.forEach((participant, identity) => {
						console.log('👤 Remote participant:', identity);
						console.log('🎤 Remote audio tracks:', participant.audioTracks.size);
						participant.audioTracks.forEach((trackPub, sid) => {
							console.log('  🎵 Remote track:', sid, {
								subscribed: trackPub.isSubscribed,
								muted: trackPub.isMuted,
								enabled: trackPub.track?.enabled,
								kind: trackPub.track?.kind,
								readyState: trackPub.track?.readyState
							});
						});
					});
					
					// Audio elements info
					if (window.livekitAudioElements) {
						console.log('🔊 Audio elements:', window.livekitAudioElements.size);
						window.livekitAudioElements.forEach((audioElement, participantId) => {
							console.log('  🎧 Audio element for:', participantId, {
								src: audioElement.srcObject ? 'has stream' : 'no stream',
								paused: audioElement.paused,
								volume: audioElement.volume,
								muted: audioElement.muted,
								readyState: audioElement.readyState,
								networkState: audioElement.networkState
							});
						});
					} else {
						console.log('❌ No audio elements storage');
					}
					
					console.log('=== END DEBUG ===');
				};
				
				// Add a function to test local audio playback (for testing purposes only)
				window.testLocalAudio = function() {
					console.log('🧪 Testing local audio playback...');
					
					if (!window.godotLiveKitRoom || !window.godotLiveKitRoom.localParticipant) {
						console.log('❌ No local participant available');
						return;
					}
					
					const local = window.godotLiveKitRoom.localParticipant;
					if (local.audioTracks.size === 0) {
						console.log('❌ No local audio tracks available');
						return;
					}
					
					// Get the local audio track (for testing only - normally you don't hear your own audio)
					local.audioTracks.forEach((trackPub, sid) => {
						if (trackPub.track) {
							console.log('🔊 Creating test audio element for local track...');
							const testAudio = document.createElement('audio');
							testAudio.srcObject = new MediaStream([trackPub.track.mediaStreamTrack]);
							testAudio.autoplay = true;
							testAudio.volume = 0.5; // Lower volume to avoid feedback
							testAudio.controls = true; // Show controls for testing
							testAudio.style.position = 'fixed';
							testAudio.style.top = '10px';
							testAudio.style.right = '10px';
							testAudio.style.zIndex = '9999';
							document.body.appendChild(testAudio);
							
							console.log('✅ Test audio element created - you should see audio controls');
							console.log('⚠️ Note: This is for testing only - normally you do not hear your own audio');
						}
					});
				};
			}
			
			// Connect to LiveKit room with proper options for audio-only
			const connectOptions = {
				autoSubscribe: true, // Automatically subscribe to remote tracks
				dynacast: false, // Disable dynacast to avoid complexity
				adaptiveStream: false, // Disable adaptive streaming for simplicity
				publishDefaults: {
					audioPreset: {
						maxBitrate: 64000, // Lower bitrate for stability
					},
					dtx: false, // Disable discontinuous transmission
					red: false, // Disable redundancy encoding
				},
				reconnect: true,
				maxRetries: 3,
				// Ensure audio subscription works
				e2ee: undefined, // Disable end-to-end encryption for simplicity
			};
			
			console.log('🔗 Connecting with options:', connectOptions);
			
			try {
				await window.godotLiveKitRoom.connect('%s', '%s', connectOptions);
			console.log('✅ Connected to LiveKit room: %s');
				
				console.log('🏠 Room state:', window.godotLiveKitRoom.state);
				console.log('🏠 Local identity:', window.godotLiveKitRoom.localParticipant?.identity);
				
				// Ensure we subscribe to any existing tracks in the room (for listen-only functionality)
				setTimeout(() => {
					if (window.subscribeToAllRemoteTracks) {
						console.log('🎧 Auto-subscribing to existing remote tracks for listen-only support...');
						window.subscribeToAllRemoteTracks();
					}
				}, 2000);
				
				// Set up global error handler for DataChannel issues
				window.addEventListener('error', (event) => {
					if (event.message && event.message.includes('DataChannel')) {
						console.warn('⚠️ DataChannel error caught (non-critical for audio):', event.message);
						event.preventDefault(); // Prevent error from bubbling up
					}
				});
				
			} catch (connectionError) {
				console.error('❌ Failed to connect to LiveKit room:', connectionError);
				window.godotMicrophoneReady = false;
				throw connectionError;
			}
			
			// Enable microphone ONLY if voice is enabled (no camera)
			if (window.godotVoiceEnabled) {
				try {
					// First get microphone access with specific constraints
					console.log('🎤 Requesting microphone access...');
					const audioConstraints = {
						audio: {
							echoCancellation: true,
							noiseSuppression: true,
							autoGainControl: true,
							sampleRate: 48000,
							channelCount: 1,
						},
						video: false
					};
					
					const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
					console.log('✅ Microphone access granted');
					console.log('🎤 Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
					
					// Enable microphone in LiveKit with error handling
					await window.godotLiveKitRoom.localParticipant.setMicrophoneEnabled(true);
					console.log('🎤 Microphone enabled in LiveKit (audio only)');
					
					// Ensure microphone is not muted
					const audioTracks = stream.getAudioTracks();
					if (audioTracks.length > 0) {
						audioTracks[0].enabled = true;
						console.log('🎤 Audio track enabled:', audioTracks[0].enabled);
					}
					
					// Check if LiveKit has the local participant's audio track
					if (window.godotLiveKitRoom.localParticipant && window.godotLiveKitRoom.localParticipant.audioTracks) {
						const localTracks = window.godotLiveKitRoom.localParticipant.audioTracks;
						console.log('🎤 Local audio tracks in LiveKit:', localTracks.size);
						localTracks.forEach((trackPub, sid) => {
							console.log('🎤 Local track:', sid, 'muted:', trackPub.isMuted, 'enabled:', trackPub.track?.enabled);
						});
					} else {
						console.log('🎤 No local participant or audio tracks available yet');
					}
					
					// Wait a moment for everything to settle
					await new Promise(resolve => setTimeout(resolve, 1000));
					
					// Verify that microphone is actually publishing
					let microphonePublishing = false;
					if (window.godotLiveKitRoom.localParticipant) {
						const audioTracks = window.godotLiveKitRoom.localParticipant.audioTracks;
						if (audioTracks && audioTracks.size > 0) {
							microphonePublishing = true;
							console.log('✅ Microphone is publishing audio tracks');
						}
					}
					
					// Signal Godot that microphone is ready (even if not publishing yet)
					window.godotMicrophoneReady = true;
					console.log('✅ Microphone setup complete - ready state set to true');
				} catch (micError) {
					console.error('❌ Failed to enable microphone:', micError);
					window.godotMicrophoneReady = false;
					
					// Try to continue if this was a non-critical error
					if (micError.message && (micError.message.includes('DataChannel') || micError.message.includes('size'))) {
						console.log('🔄 Attempting to continue despite non-critical error...');
						window.godotMicrophoneReady = true; // Try to proceed anyway
					}
				}
			}
			
		} catch (error) {
			console.error('❌ Error connecting to LiveKit room:', error);
			window.godotMicrophoneReady = false;
		}
	})();
	""" % [data.url, data.token, data.roomName]
	
	JavaScriptBridge.eval(js_connect)
	
	# Wait a moment and check if microphone is ready
	call_deferred("_check_microphone_ready")

func set_voice_enabled(enabled: bool) -> void:
	"""Enable or disable voice chat"""
	print("LiveKitVoiceManager: 🎤 set_voice_enabled called with: ", enabled)
	voice_enabled = enabled
	is_recording = enabled
	
	if enabled:
		# Request LiveKit token when enabling voice
		if room:
			print("LiveKitVoiceManager: 🎟️ Requesting LiveKit token for room: ", current_voice_room)
			room.send("get_livekit_token", {"roomName": current_voice_room})
		else:
			print("LiveKitVoiceManager: ❌ No room available to request token")
	
	var js_voice = """
	(async function() {
	window.godotVoiceEnabled = %s;
	
	if (window.godotLiveKitRoom && window.godotLiveKitRoom.localParticipant) {
		if (%s) {
				try {
					await window.godotLiveKitRoom.localParticipant.setMicrophoneEnabled(true);
					console.log('🎤 Voice enabled (microphone only)');
					
					// Wait a moment for track to be published, then verify
					setTimeout(() => {
						console.log('🔍 Verifying local audio track publishing...');
						console.log('🔍 Local participant identity:', window.godotLiveKitRoom.localParticipant.identity);
						
						if (window.godotLiveKitRoom.localParticipant && window.godotLiveKitRoom.localParticipant.audioTracks) {
							const audioTracks = window.godotLiveKitRoom.localParticipant.audioTracks;
							console.log('🎤 Local audio tracks count:', audioTracks.size);
							
							audioTracks.forEach((trackPub, sid) => {
								console.log('🎤 Local track details:', {
									sid: sid,
									trackSid: trackPub.trackSid,
									muted: trackPub.isMuted,
									enabled: trackPub.track?.enabled,
									kind: trackPub.kind,
									source: trackPub.source
								});
								if (trackPub.track) {
									trackPub.track.enabled = true;
								}
							});
							
							if (audioTracks.size === 0) {
								console.error('❌ No audio tracks found on local participant!');
							}
						} else {
							console.error('❌ Local participant or audio tracks not available for verification');
						}
					}, 1000);
				} catch (error) {
					console.error('❌ Failed to enable microphone:', error);
				}
			} else {
				try {
					await window.godotLiveKitRoom.localParticipant.setMicrophoneEnabled(false);
					console.log('🔇 Voice disabled');
				} catch (error) {
					console.error('❌ Failed to disable microphone:', error);
				}
			}
		} else {
			console.log('⚠️ LiveKit room or participant not available for voice toggle');
		}
	})();
	""" % [str(enabled).to_lower(), str(enabled).to_lower()]
	
	JavaScriptBridge.eval(js_voice)
	
	voice_chat_enabled_changed.emit(enabled)

func get_voice_enabled() -> bool:
	"""Get current voice chat enabled state"""
	return voice_enabled

func get_is_recording() -> bool:
	"""Get current recording state"""
	return is_recording

func on_voice_zone_changed(new_zone: String = "lobby") -> void:
	"""Called when player moves between voice zones"""
	if new_zone != current_voice_room:
		print("LiveKitVoiceManager: 🚪 Voice zone changed from '", current_voice_room, "' to '", new_zone, "'")
		current_voice_room = new_zone
		
		# Request new token for the new room
		if room:
			room.send("get_livekit_token", {"roomName": current_voice_room})

func join_team_room(team_id: String) -> void:
	"""Join a specific team's voice room"""
	var room_name = "team-" + team_id
	on_voice_zone_changed(room_name)

func join_lobby() -> void:
	"""Join the main lobby voice room"""
	on_voice_zone_changed("lobby")

func _check_microphone_ready() -> void:
	"""Check if microphone is ready and emit signal"""
	if not OS.has_feature("web"):
		return
	
	var js_check = """
	(function() {
		return window.godotMicrophoneReady || false;
	})();
	"""
	
	# Check multiple times with shorter intervals for better responsiveness
	var max_attempts = 20  # Check for up to 4 seconds (20 * 0.2s)
	var attempt = 0
	
	while attempt < max_attempts:
		var is_ready = JavaScriptBridge.eval(js_check)
		print("LiveKitVoiceManager: 🎤 Microphone ready check ", attempt + 1, "/", max_attempts, ": ", is_ready)
		
		if is_ready:
			print("LiveKitVoiceManager: ✅ Microphone ready - emitting signal")
			microphone_ready_changed.emit(true)
			return
		
		# Wait 200ms before next check
		await get_tree().create_timer(0.2).timeout
		attempt += 1
	
	# If we get here, microphone is not ready after all attempts
	print("LiveKitVoiceManager: ❌ Microphone not ready after ", max_attempts, " attempts - emitting false signal")
	microphone_ready_changed.emit(false)

# Additional compatibility methods that VoiceChat wrapper might call

func update_local_player_position(position: Vector2) -> void:
	"""Update local player position for proximity-based voice (placeholder for LiveKit)"""
	# LiveKit doesn't need position tracking for basic functionality
	pass

func update_player_position(session_id: String, position: Vector2) -> void:
	"""Update remote player position for proximity-based voice (placeholder for LiveKit)"""
	# LiveKit doesn't need position tracking for basic functionality
	pass

func _calculate_proximity_volume(distance: float) -> float:
	"""Calculate proximity volume (not needed for LiveKit but kept for compatibility)"""
	# LiveKit handles audio automatically, return full volume
	return 1.0

func play_voice_data(audio_bytes: PackedByteArray, volume: float = 1.0) -> void:
	"""Play voice data (not needed for LiveKit as it handles audio automatically)"""
	# LiveKit handles audio playback automatically
	pass

func debug_voice_chat_state() -> Dictionary:
	"""Return debug information about voice chat state"""
	var debug_info = {
		"voice_enabled": voice_enabled,
		"is_recording": is_recording,
		"current_voice_room": current_voice_room,
		"has_room": room != null,
		"livekit_manager": true,
		"manager_type": "LiveKit SFU"
	}
	
	# Add JavaScript debug info
	if OS.has_feature("web"):
		var js_debug = """
		(function() {
			const info = {
				livekit_ready: !!window.godotLiveKitReady,
				room_connected: !!window.godotLiveKitRoom && window.godotLiveKitRoom.state === 'connected',
				microphone_ready: !!window.godotMicrophoneReady,
				audio_elements_count: window.livekitAudioElements ? window.livekitAudioElements.size : 0,
				local_tracks: 0,
				remote_tracks: 0
			};
			
			if (window.godotLiveKitRoom && window.godotLiveKitRoom.localParticipant && window.godotLiveKitRoom.localParticipant.audioTracks) {
				info.local_tracks = window.godotLiveKitRoom.localParticipant.audioTracks.size;
			}
			
			if (window.godotLiveKitRoom && window.godotLiveKitRoom.participants) {
				info.remote_tracks = Array.from(window.godotLiveKitRoom.participants.values()).reduce((count, p) => {
					return count + (p.audioTracks ? p.audioTracks.size : 0);
				}, 0);
			}
			
			return info;
		})();
		"""
		var js_result = JavaScriptBridge.eval(js_debug)
		if js_result:
			debug_info["javascript_state"] = js_result
	
	return debug_info
