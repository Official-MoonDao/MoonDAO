# res://scripts/MicrophoneUI.gd
extends Control

signal microphone_toggled(enabled: bool)

@onready var voice_chat: Node = null
@onready var mic_button: Button
@onready var mic_icon: Label
@onready var status_label: Label
@onready var glass_panel: Panel

var microphone_enabled := false

func _ready() -> void:
	print("MicrophoneUI: _ready() called")
	setup_glass_morphism_ui()
	# Wait a frame for other nodes to be ready
	await get_tree().process_frame
	connect_voice_chat()

func setup_glass_morphism_ui() -> void:
	print("MicrophoneUI: Setting up glass morphism interface...")
	
	# The main control fills the screen, we'll position elements absolutely
	mouse_filter = Control.MOUSE_FILTER_IGNORE  # Let clicks pass through except for our button
	
	# Wait for the parent to be ready so we can get screen size
	await get_tree().process_frame
	
	# Get screen size from parent control
	var screen_size = get_viewport().get_visible_rect().size
	print("MicrophoneUI: Screen size: ", screen_size)
	
	# Create glass panel background positioned in bottom-right
	glass_panel = Panel.new()
	glass_panel.name = "GlassPanel"
	glass_panel.size = Vector2(100, 100)
	glass_panel.position = Vector2(screen_size.x - 120, screen_size.y - 120)  # 20px margin from bottom-right
	add_child(glass_panel)
	
	# Apply glass morphism styling
	var style_box = StyleBoxFlat.new()
	
	# Glass morphism colors (semi-transparent with blur effect)
	style_box.bg_color = Color(1.0, 1.0, 1.0, 0.1)  # Very transparent white
	# Remove borders for cleaner look
	style_box.border_width_left = 0
	style_box.border_width_right = 0
	style_box.border_width_top = 0
	style_box.border_width_bottom = 0
	
	# Rounded corners for modern look
	style_box.corner_radius_top_left = 20
	style_box.corner_radius_top_right = 20
	style_box.corner_radius_bottom_left = 20
	style_box.corner_radius_bottom_right = 20
	
	# Add subtle shadow
	style_box.shadow_color = Color(0.0, 0.0, 0.0, 0.3)
	style_box.shadow_size = 5
	style_box.shadow_offset = Vector2(2, 2)
	
	glass_panel.add_theme_stylebox_override("panel", style_box)
	
	# Create microphone button (positioned inside glass panel)
	mic_button = Button.new()
	mic_button.name = "MicButton"
	mic_button.size = Vector2(80, 80)
	mic_button.position = Vector2(screen_size.x - 110, screen_size.y - 110)  # 10px margin inside glass panel
	mic_button.flat = true
	mic_button.text = ""
	mic_button.mouse_filter = Control.MOUSE_FILTER_PASS  # Allow button clicks
	add_child(mic_button)
	
	# Style the button with glass morphism
	var button_style_normal = StyleBoxFlat.new()
	button_style_normal.bg_color = Color(1.0, 1.0, 1.0, 0.05)
	button_style_normal.corner_radius_top_left = 15
	button_style_normal.corner_radius_top_right = 15
	button_style_normal.corner_radius_bottom_left = 15
	button_style_normal.corner_radius_bottom_right = 15
	
	var button_style_hover = StyleBoxFlat.new()
	button_style_hover.bg_color = Color(1.0, 1.0, 1.0, 0.15)
	button_style_hover.corner_radius_top_left = 15
	button_style_hover.corner_radius_top_right = 15
	button_style_hover.corner_radius_bottom_left = 15
	button_style_hover.corner_radius_bottom_right = 15
	
	var button_style_pressed = StyleBoxFlat.new()
	button_style_pressed.bg_color = Color(0.3, 0.8, 0.3, 0.3)  # Green when active
	button_style_pressed.corner_radius_top_left = 15
	button_style_pressed.corner_radius_top_right = 15
	button_style_pressed.corner_radius_bottom_left = 15
	button_style_pressed.corner_radius_bottom_right = 15
	
	mic_button.add_theme_stylebox_override("normal", button_style_normal)
	mic_button.add_theme_stylebox_override("hover", button_style_hover)
	mic_button.add_theme_stylebox_override("pressed", button_style_pressed)
	
	# Create microphone icon (using emoji/text)
	mic_icon = Label.new()
	mic_icon.name = "MicIcon"
	mic_icon.text = "🎤"
	mic_icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mic_icon.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	mic_icon.size = Vector2(80, 80)
	mic_icon.position = Vector2(screen_size.x - 110, screen_size.y - 110)  # Same position as button
	mic_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(mic_icon)
	
	# Style the icon
	mic_icon.add_theme_font_size_override("font_size", 32)
	mic_icon.add_theme_color_override("font_color", Color.WHITE)
	mic_icon.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	mic_icon.add_theme_constant_override("shadow_offset_x", 1)
	mic_icon.add_theme_constant_override("shadow_offset_y", 1)
	
	# Create status label
	status_label = Label.new()
	status_label.name = "StatusLabel"
	status_label.text = "Off"
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.size = Vector2(100, 20)
	status_label.position = Vector2(screen_size.x - 120, screen_size.y - 15)  # Below the glass panel
	status_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(status_label)
	
	# Style the status label
	status_label.add_theme_font_size_override("font_size", 12)
	status_label.add_theme_color_override("font_color", Color(1.0, 1.0, 1.0, 0.8))
	status_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	status_label.add_theme_constant_override("shadow_offset_x", 1)
	status_label.add_theme_constant_override("shadow_offset_y", 1)
	
	# Connect button signal
	mic_button.pressed.connect(_on_mic_button_pressed)
	print("MicrophoneUI: Button signal connected successfully")
	
	print("MicrophoneUI: Glass morphism UI setup complete")
	print("MicrophoneUI: Final positions - Panel: ", glass_panel.position, " Button: ", mic_button.position)

func connect_voice_chat() -> void:
	print("MicrophoneUI: Searching for VoiceChat node...")
	
	# Try multiple paths to find VoiceChat
	var paths_to_try = [
		"../../VoiceChat",  # Main/VoiceChat from Main/UI/MicrophoneUI
		"../VoiceChat",     # Alternative if structure is different
		"/root/Main/VoiceChat"  # Absolute path as fallback
	]
	
	for path in paths_to_try:
		print("MicrophoneUI: Trying path: ", path)
		var candidate = get_node_or_null(path)
		if candidate:
			print("MicrophoneUI: Found node at path: ", path, " - checking if it's VoiceChat...")
			print("MicrophoneUI: Node name: ", candidate.name, " class: ", candidate.get_class())
			if candidate.has_method("set_voice_enabled") and candidate.has_method("get_voice_enabled"):
				voice_chat = candidate
				print("MicrophoneUI: ✅ Confirmed VoiceChat at path: ", path)
				break
			else:
				print("MicrophoneUI: ❌ Node doesn't have VoiceChat methods: ", path)
		else:
			print("MicrophoneUI: ❌ Path failed: ", path)
	
	# Manual search as final fallback
	if not voice_chat:
		print("MicrophoneUI: Trying manual search...")
		var main_node = get_node_or_null("../..")
		if main_node:
			print("MicrophoneUI: Found main node: ", main_node.name)
			print("MicrophoneUI: Main node children: ")
			for child in main_node.get_children():
				print("  - ", child.name, " (", child.get_class(), ") script: ", child.get_script())
				if child.name == "VoiceChat":
					print("MicrophoneUI: Found VoiceChat node, checking methods...")
					print("MicrophoneUI: Has set_voice_enabled: ", child.has_method("set_voice_enabled"))
					print("MicrophoneUI: Has get_voice_enabled: ", child.has_method("get_voice_enabled"))
					print("MicrophoneUI: Has debug_voice_chat_state: ", child.has_method("debug_voice_chat_state"))
					
					# Try to force the script to work by calling a simple method
					if child.has_method("set_voice_enabled"):
						voice_chat = child
						print("MicrophoneUI: ✅ Found valid VoiceChat in children")
						break
					else:
						print("MicrophoneUI: ⚠️ VoiceChat node found but script not loaded properly")
						# Try to force script reload or find the right instance
						if child.get_script():
							print("MicrophoneUI: Script exists: ", child.get_script().resource_path)
							print("MicrophoneUI: Script is valid: ", child.get_script().is_valid())
							
							# Try to force reload the script
							print("MicrophoneUI: Attempting to reload VoiceChat script...")
							var script = load("res://scripts/VoiceChat.gd")
							if script:
								child.set_script(script)
								# Force the node to reinitialize
								child.call("_ready")
								
								# Check again after reload
								if child.has_method("set_voice_enabled"):
									voice_chat = child
									print("MicrophoneUI: ✅ Successfully reloaded script and found VoiceChat!")
									break
								else:
									print("MicrophoneUI: ❌ Script reloaded but methods still not available")
									print("MicrophoneUI: Available methods: ")
									for method in child.get_method_list():
										if "voice" in method.name.to_lower() or "recording" in method.name.to_lower():
											print("  - ", method.name)
							else:
								print("MicrophoneUI: ❌ Could not reload VoiceChat.gd script")
						else:
							print("MicrophoneUI: No script attached to VoiceChat node!")
							# Try to manually load the script
							var script = load("res://scripts/VoiceChat.gd")
							if script:
								print("MicrophoneUI: Attempting to manually attach VoiceChat script...")
								child.set_script(script)
								if child.has_method("set_voice_enabled"):
									voice_chat = child
									print("MicrophoneUI: ✅ Successfully attached script and found VoiceChat!")
									break
								else:
									print("MicrophoneUI: ❌ Script attached but methods still not available")
							else:
								print("MicrophoneUI: ❌ Could not load VoiceChat.gd script")
		
		# Try finding by group if still not found
		if not voice_chat:
			print("MicrophoneUI: Searching by group 'voice_chat'...")
			var group_nodes = get_tree().get_nodes_in_group("voice_chat")
			print("MicrophoneUI: Found ", group_nodes.size(), " nodes in voice_chat group")
			
			for node in group_nodes:
				print("MicrophoneUI: Group node: ", node.name, " (", node.get_class(), ") script: ", node.get_script())
				if node.has_method("set_voice_enabled"):
					voice_chat = node
					print("MicrophoneUI: ✅ Found valid VoiceChat in group")
					break
		
		# Final attempt: search entire tree for any node with VoiceChat methods
		if not voice_chat:
			print("MicrophoneUI: Final search - looking for ANY node with VoiceChat methods...")
			_recursive_node_search(get_tree().root)
	
	if voice_chat:
		print("MicrophoneUI: ✅ Connected to VoiceChat successfully!")
		print("MicrophoneUI: VoiceChat type: ", voice_chat.get_class())
		print("MicrophoneUI: VoiceChat voice_enabled: ", voice_chat.voice_enabled)
		print("MicrophoneUI: VoiceChat is_recording: ", voice_chat.is_recording)
	else:
		print("MicrophoneUI: ❌ ERROR - VoiceChat not found after all attempts!")

func _on_mic_button_pressed() -> void:
	print("MicrophoneUI: 🎤 BUTTON PRESSED! - Current state: ", microphone_enabled)
	toggle_microphone()

func toggle_microphone() -> void:
	microphone_enabled = !microphone_enabled
	print("MicrophoneUI: Microphone toggled to: ", microphone_enabled)
	
	update_ui_state()
	
	# If voice_chat is null, try to reconnect
	if not voice_chat:
		print("MicrophoneUI: voice_chat is null! Attempting to reconnect...")
		connect_voice_chat()
	
	if voice_chat:
		print("MicrophoneUI: About to call voice_chat.set_voice_enabled(", microphone_enabled, ")")
		
		# First, let's verify this is really a VoiceChat node
		print("MicrophoneUI: Node type: ", voice_chat.get_class())
		print("MicrophoneUI: Node script: ", voice_chat.get_script())
		
		# Try the debug function first
		if voice_chat.has_method("debug_voice_chat_state"):
			var debug_info = voice_chat.debug_voice_chat_state()
			print("MicrophoneUI: Debug info: ", debug_info)
		else:
			print("MicrophoneUI: debug_voice_chat_state method not found!")
		
		var result = voice_chat.set_voice_enabled(microphone_enabled)
		print("MicrophoneUI: set_voice_enabled call result: ", result)
		
		# Use getter functions to check state
		if voice_chat.has_method("get_voice_enabled"):
			print("MicrophoneUI: Voice enabled state: ", voice_chat.get_voice_enabled())
		else:
			print("MicrophoneUI: get_voice_enabled method not found!")
			
		if voice_chat.has_method("get_is_recording"):
			print("MicrophoneUI: Recording state: ", voice_chat.get_is_recording())
		else:
			print("MicrophoneUI: get_is_recording method not found!")
			
		# Fallback: try direct property access
		print("MicrophoneUI: Direct property - voice_enabled: ", voice_chat.voice_enabled)
		print("MicrophoneUI: Direct property - is_recording: ", voice_chat.is_recording)
	else:
		print("MicrophoneUI: ERROR - voice_chat is still null after reconnection attempt!")
	
	# Emit signal for other components
	microphone_toggled.emit(microphone_enabled)

func update_ui_state() -> void:
	if microphone_enabled:
		mic_icon.text = "🎤"
		mic_icon.add_theme_color_override("font_color", Color(0.3, 1.0, 0.3))  # Green
		status_label.text = "Live"
		status_label.add_theme_color_override("font_color", Color(0.3, 1.0, 0.3, 0.9))
		
		# Update button style to show active state (no borders)
		var active_style = StyleBoxFlat.new()
		active_style.bg_color = Color(0.3, 0.8, 0.3, 0.2)
		# Remove borders for clean look
		active_style.border_width_left = 0
		active_style.border_width_right = 0
		active_style.border_width_top = 0
		active_style.border_width_bottom = 0
		active_style.corner_radius_top_left = 15
		active_style.corner_radius_top_right = 15
		active_style.corner_radius_bottom_left = 15
		active_style.corner_radius_bottom_right = 15
		mic_button.add_theme_stylebox_override("normal", active_style)
		
		# Add subtle pulsing effect to show it's always transmitting
		mic_icon.modulate.a = 1.0
		var tween = create_tween()
		tween.set_loops()
		tween.tween_property(mic_icon, "modulate:a", 0.7, 1.0)
		tween.tween_property(mic_icon, "modulate:a", 1.0, 1.0)
		
	else:
		mic_icon.text = "mic"
		mic_icon.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))  # Gray
		status_label.text = "Off"
		status_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7, 0.8))
		mic_icon.modulate.a = 1.0  # Stop any pulsing
		
		# Reset button style to normal
		var normal_style = StyleBoxFlat.new()
		normal_style.bg_color = Color(1.0, 1.0, 1.0, 0.05)
		normal_style.corner_radius_top_left = 15
		normal_style.corner_radius_top_right = 15
		normal_style.corner_radius_bottom_left = 15
		normal_style.corner_radius_bottom_right = 15
		mic_button.add_theme_stylebox_override("normal", normal_style)

func _process(_delta: float) -> void:
	# No need to track recording state - when enabled, it's always "on"
	# The microphone is either enabled (always transmitting) or disabled
	
	# Update positions if screen size changes
	_update_positions_if_needed()

func _update_positions_if_needed() -> void:
	if not glass_panel or not mic_button or not mic_icon or not status_label:
		return
		
	var current_screen_size = get_viewport().get_visible_rect().size
	var target_panel_pos = Vector2(current_screen_size.x - 120, current_screen_size.y - 120)
	
	# Only update if position changed significantly
	if glass_panel.position.distance_to(target_panel_pos) > 5.0:
		print("MicrophoneUI: Updating positions for screen size: ", current_screen_size)
		glass_panel.position = target_panel_pos
		mic_button.position = Vector2(current_screen_size.x - 110, current_screen_size.y - 110)
		mic_icon.position = Vector2(current_screen_size.x - 110, current_screen_size.y - 110)
		status_label.position = Vector2(current_screen_size.x - 120, current_screen_size.y - 15)

func _recursive_node_search(node: Node) -> void:
	"""Recursively search for VoiceChat node with proper methods"""
	if voice_chat:
		return  # Already found
	
	# Check current node
	if node.has_method("set_voice_enabled") and node.has_method("get_voice_enabled"):
		print("MicrophoneUI: ✅ Found VoiceChat via recursive search: ", node.name, " at ", node.get_path())
		voice_chat = node
		return
	
	# Check children
	for child in node.get_children():
		_recursive_node_search(child)

func set_microphone_enabled(enabled: bool) -> void:
	"""External function to set microphone state"""
	if microphone_enabled != enabled:
		microphone_enabled = enabled
		update_ui_state()
		if voice_chat:
			voice_chat.set_voice_enabled(microphone_enabled)
