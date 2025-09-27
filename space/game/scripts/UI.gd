# res://scripts/UI.gd
extends Control

signal microphone_toggled(enabled: bool)

@onready var voice_chat: Node = null
@onready var mic_button: Button
@onready var mic_icon: Label
@onready var status_label: Label
@onready var spacebar_hint_label: Label
@onready var glass_panel: Panel
@onready var teams_button: Button
@onready var teams_icon: Label
@onready var teams_glass_panel: Panel
var microphone_enabled := false
var mic_is_loading := false
var teams_modal: Control = null
var main_client: Node = null

func _ready() -> void:
	print("UI: _ready() called")
	setup_glass_morphism_ui()
	# Wait a frame for other nodes to be ready
	await get_tree().process_frame
	connect_voice_chat()


func setup_glass_morphism_ui() -> void:
	print("UI: Setting up glass morphism interface...")
	
	# The main control fills the screen, we'll position elements absolutely
	mouse_filter = Control.MOUSE_FILTER_IGNORE  # Let clicks pass through except for our button
	
	# Wait for the parent to be ready so we can get screen size
	await get_tree().process_frame
	
	# Get screen size from parent control
	var screen_size = get_viewport().get_visible_rect().size
	print("UI: Screen size: ", screen_size)
	
	# Create glass panel background positioned in bottom-right
	glass_panel = Panel.new()
	glass_panel.name = "GlassPanel"
	glass_panel.size = Vector2(100, 100)
	glass_panel.position = Vector2(screen_size.x - 120, screen_size.y - 120)  # 20px margin from bottom-right
	add_child(glass_panel)
	
	# Create teams glass panel (positioned to the left of mic panel)
	teams_glass_panel = Panel.new()
	teams_glass_panel.name = "TeamsGlassPanel"
	teams_glass_panel.size = Vector2(100, 100)
	teams_glass_panel.position = Vector2(screen_size.x - 240, screen_size.y - 120)  # 20px gap from mic panel
	add_child(teams_glass_panel)
	
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
	teams_glass_panel.add_theme_stylebox_override("panel", style_box)
	
	# Create teams button (positioned inside teams glass panel)
	teams_button = Button.new()
	teams_button.name = "TeamsButton"
	teams_button.size = Vector2(80, 80)
	teams_button.position = Vector2(screen_size.x - 230, screen_size.y - 110)  # 10px margin inside teams glass panel
	teams_button.flat = true
	teams_button.text = ""
	teams_button.mouse_filter = Control.MOUSE_FILTER_PASS
	teams_button.focus_mode = Control.FOCUS_NONE  # Disable focus to prevent selection box
	add_child(teams_button)
	
	# Create microphone button (positioned inside glass panel)
	mic_button = Button.new()
	mic_button.name = "MicButton"
	mic_button.size = Vector2(80, 80)
	mic_button.position = Vector2(screen_size.x - 110, screen_size.y - 110)  # 10px margin inside glass panel
	mic_button.flat = true
	mic_button.text = ""
	mic_button.mouse_filter = Control.MOUSE_FILTER_PASS  # Allow button clicks
	mic_button.focus_mode = Control.FOCUS_NONE  # Disable focus to prevent selection box
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
	
	# Apply same styling to teams button
	teams_button.add_theme_stylebox_override("normal", button_style_normal)
	teams_button.add_theme_stylebox_override("hover", button_style_hover)
	teams_button.add_theme_stylebox_override("pressed", button_style_pressed)
	
	# Create microphone icon (using emoji/text)
	mic_icon = Label.new()
	mic_icon.name = "MicIcon"
	mic_icon.text = "mic"
	mic_icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mic_icon.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	mic_icon.size = Vector2(80, 80)
	mic_icon.position = Vector2(screen_size.x - 110, screen_size.y - 110)  # Same position as button
	mic_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(mic_icon)
	
	# Style the icon
	mic_icon.add_theme_font_size_override("font_size", 24)
	mic_icon.add_theme_color_override("font_color", Color.WHITE)
	mic_icon.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	mic_icon.add_theme_constant_override("shadow_offset_x", 1)
	mic_icon.add_theme_constant_override("shadow_offset_y", 1)
	
	# Create teams icon
	teams_icon = Label.new()
	teams_icon.name = "TeamsIcon"
	teams_icon.text = "teams"  # Group/team icon
	teams_icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	teams_icon.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	teams_icon.size = Vector2(80, 80)
	teams_icon.position = Vector2(screen_size.x - 230, screen_size.y - 110)  # Same position as teams button
	teams_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(teams_icon)
	
	# Style the teams icon
	teams_icon.add_theme_font_size_override("font_size", 24)
	teams_icon.add_theme_color_override("font_color", Color.WHITE)
	teams_icon.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	teams_icon.add_theme_constant_override("shadow_offset_x", 1)
	teams_icon.add_theme_constant_override("shadow_offset_y", 1)
	
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
	
	# Create spacebar hint label
	spacebar_hint_label = Label.new()
	spacebar_hint_label.name = "SpacebarHintLabel"
	spacebar_hint_label.text = "(spacebar)"
	spacebar_hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	spacebar_hint_label.size = Vector2(100, 15)
	spacebar_hint_label.position = Vector2(screen_size.x - 120, screen_size.y + 5)  # Below the status label
	spacebar_hint_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(spacebar_hint_label)
	
	# Style the spacebar hint label
	spacebar_hint_label.add_theme_font_size_override("font_size", 10)
	spacebar_hint_label.add_theme_color_override("font_color", Color(1.0, 1.0, 1.0, 0.6))
	spacebar_hint_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	spacebar_hint_label.add_theme_constant_override("shadow_offset_x", 1)
	spacebar_hint_label.add_theme_constant_override("shadow_offset_y", 1)
	
	# Note: We'll use the mic_icon for all states instead of a separate loading spinner
	
	# Connect button signals
	mic_button.pressed.connect(_on_mic_button_pressed)
	teams_button.pressed.connect(_on_teams_button_pressed)
	print("UI: Button signals connected successfully")
	print("UI: Teams button created at position: ", teams_button.position)
	print("UI: Teams button size: ", teams_button.size)
	print("UI: Teams button visible: ", teams_button.visible)
	print("UI: Teams button mouse_filter: ", teams_button.mouse_filter)
	
	print("UI: Glass morphism UI setup complete")
	print("UI: Final positions - Panel: ", glass_panel.position, " Button: ", mic_button.position)

func connect_voice_chat() -> void:
	print("UI: �� Searching for LiveKit voice chat system...")
	print("UI: 🔍 Current node path: ", get_path())
	
	# Only look for VoiceChat wrapper (which uses LiveKit) - no WebRTC references
	var paths_to_try = [
		"../../VoiceChat",           # Main/VoiceChat wrapper (PRIORITY)
		"/root/Main/VoiceChat",      # Absolute wrapper fallback
		"../VoiceChat",              # Alternative wrapper path
	]
	
	for path in paths_to_try:
		print("UI: Trying path: ", path)
		var candidate = get_node_or_null(path)
		if candidate:
			print("UI: Found node at path: ", path, " - checking if it has voice chat methods...")
			print("UI: Node name: ", candidate.name, " class: ", candidate.get_class(), " script: ", candidate.get_script())
			if candidate.has_method("set_voice_enabled") and candidate.has_method("get_voice_enabled"):
				voice_chat = candidate
				print("UI: ✅ CONFIRMED voice chat node at path: ", path)
				print("UI: ✅ Connected to: ", candidate.name, " (LiveKit voice system)")
				break
			else:
				print("UI: ❌ Node doesn't have voice chat methods: ", path)
		else:
			print("UI: ❌ Path failed: ", path)
	
	# Manual search as fallback
	if not voice_chat:
		print("UI: Trying manual search...")
		var main_node = get_node_or_null("../..")
		if main_node:
			print("UI: Found main node: ", main_node.name)
			print("UI: Main node children: ")
			for child in main_node.get_children():
				print("  - ", child.name, " (", child.get_class(), ") script: ", child.get_script())
				# Only look for VoiceChat (LiveKit wrapper)
				if child.name == "VoiceChat":
					print("UI: Found voice chat node, checking methods...")
					print("UI: Has set_voice_enabled: ", child.has_method("set_voice_enabled"))
					print("UI: Has get_voice_enabled: ", child.has_method("get_voice_enabled"))
					
					if child.has_method("set_voice_enabled"):
						voice_chat = child
						print("UI: ✅ Found valid voice chat node in children: ", child.name)
						break
					else:
						print("UI: ⚠️ Voice chat node found but methods not available: ", child.name)
		
		# Try finding by group if still not found
		if not voice_chat:
			print("UI: Searching by group 'voice_chat'...")
			var group_nodes = get_tree().get_nodes_in_group("voice_chat")
			print("UI: Found ", group_nodes.size(), " nodes in voice_chat group")
			
			for node in group_nodes:
				print("UI: Group node: ", node.name, " (", node.get_class(), ") script: ", node.get_script())
				if node.has_method("set_voice_enabled"):
					voice_chat = node
					print("UI: ✅ Found valid VoiceChat in group")
					break
		
		# Final attempt: search entire tree for any node with VoiceChat methods
		if not voice_chat:
			print("UI: Final search - looking for ANY node with VoiceChat methods...")
			_recursive_node_search(get_tree().root)
	
	if voice_chat:
		print("UI: ✅ Connected to LiveKit voice chat successfully!")
		print("UI: Voice chat type: ", voice_chat.get_class())
		print("UI: Voice chat name: ", voice_chat.name)
		if voice_chat.has_method("get_voice_enabled"):
			print("UI: Voice enabled: ", voice_chat.get_voice_enabled())
		if voice_chat.has_method("get_is_recording"):
			print("UI: Is recording: ", voice_chat.get_is_recording())
		
		# Connect to microphone ready signal
		if voice_chat.has_signal("microphone_ready_changed"):
			if not voice_chat.microphone_ready_changed.is_connected(_on_microphone_ready_changed):
				voice_chat.microphone_ready_changed.connect(_on_microphone_ready_changed)
				print("UI: ✅ Connected to microphone_ready_changed signal")
		else:
			print("UI: ⚠️ microphone_ready_changed signal not found")
	else:
		print("UI: ❌ ERROR - LiveKit voice chat system not found!")

func _on_mic_button_pressed() -> void:
	print("UI: 🎤 BUTTON PRESSED! - Current state: ", microphone_enabled)
	toggle_microphone()

func _on_teams_button_pressed() -> void:
	print("UI: 👥 TEAMS BUTTON PRESSED!")
	print("UI: Signal definitely triggered!")
	
	# Debug: Check main client
	if not main_client:
		main_client = get_node("/root/Main")
	
	if main_client:
		print("✅ Main client found")
		
		# Debug: Check room state directly
		if "room" in main_client and main_client.room:
			print("✅ Room found in main client")
			var room_state = main_client.room.state
			if room_state:
				print("✅ Room state found")
				if "players" in room_state:
					print("✅ Players in room state: ", room_state.players.keys())
					for session_id in room_state.players.keys():
						var player = room_state.players.at(session_id)  # Use at() method for MapSchema
						print("  Player ", session_id, ":")
						print("    - name: ", player.name if "name" in player else "N/A")
						print("    - teamIds: ", player.teamIds if "teamIds" in player else "N/A")
						print("    - currentTeamRoom: ", player.currentTeamRoom if "currentTeamRoom" in player else "N/A")
		
		# Debug: Check team room manager
		if "team_room_manager" in main_client and main_client.team_room_manager:
			print("✅ Team room manager found")
			var team_rooms = main_client.team_room_manager.get_team_rooms()
			print("✅ Team rooms available: ", team_rooms.keys())
			for team_id in team_rooms.keys():
				var team_room = team_rooms[team_id]
				print("  Team room ", team_id, ":")
				print("    - team_name: ", team_room.team_name if "team_name" in team_room else "N/A")
				print("    - position: ", team_room.global_position if "global_position" in team_room else "N/A")
	
	_show_teams_modal()

func toggle_microphone() -> void:
	microphone_enabled = !microphone_enabled
	print("UI: Microphone toggled to: ", microphone_enabled)
	
	# Show loading state immediately when enabling mic
	if microphone_enabled:
		mic_is_loading = true
		update_ui_state()
	else:
		mic_is_loading = false
		update_ui_state()
	
	# If voice_chat is null, try to reconnect
	if not voice_chat:
		print("UI: voice_chat is null! Attempting to reconnect...")
		connect_voice_chat()
	
	if voice_chat:
		print("UI: About to call voice_chat.set_voice_enabled(", microphone_enabled, ")")
		
		# First, let's verify this is really a VoiceChat node
		print("UI: Node type: ", voice_chat.get_class())
		print("UI: Node script: ", voice_chat.get_script())
		
		# Try the debug function first
		if voice_chat.has_method("debug_voice_chat_state"):
			var debug_info = voice_chat.debug_voice_chat_state()
			print("UI: Debug info: ", debug_info)
		else:
			print("UI: debug_voice_chat_state method not found!")
		
		var result = voice_chat.set_voice_enabled(microphone_enabled)
		print("UI: set_voice_enabled call result: ", result)
		
		# Use getter functions to check state
		if voice_chat.has_method("get_voice_enabled"):
			print("UI: Voice enabled state: ", voice_chat.get_voice_enabled())
		else:
			print("UI: get_voice_enabled method not found!")
			
		if voice_chat.has_method("get_is_recording"):
			print("UI: Recording state: ", voice_chat.get_is_recording())
		else:
			print("UI: get_is_recording method not found!")
			
		# Fallback: try direct property access
		print("UI: Direct property - voice_enabled: ", voice_chat.voice_enabled)
		print("UI: Direct property - is_recording: ", voice_chat.is_recording)
	else:
		print("UI: ERROR - voice_chat is still null after reconnection attempt!")
	
	# Emit signal for other components
	microphone_toggled.emit(microphone_enabled)

func _on_microphone_ready_changed(is_ready: bool) -> void:
	"""Handle microphone ready state changes"""
	print("UI: Microphone ready changed to: ", is_ready)
	if microphone_enabled:  # Only update if mic is enabled
		mic_is_loading = not is_ready
		update_ui_state()

func update_ui_state() -> void:
	if mic_is_loading and microphone_enabled:
		# Loading state: "..." with default styling
		mic_icon.text = "..."
		mic_icon.add_theme_color_override("font_color", Color.WHITE)  # Default white
		status_label.text = "Loading..."
		status_label.add_theme_color_override("font_color", Color(1.0, 1.0, 1.0, 0.8))  # Default white
		
		# Default button style for loading
		var loading_style = StyleBoxFlat.new()
		loading_style.bg_color = Color(1.0, 1.0, 1.0, 0.05)  # Default glass style
		loading_style.corner_radius_top_left = 15
		loading_style.corner_radius_top_right = 15
		loading_style.corner_radius_bottom_left = 15
		loading_style.corner_radius_bottom_right = 15
		mic_button.add_theme_stylebox_override("normal", loading_style)
		
		# Stop any previous animations
		mic_icon.modulate.a = 1.0
		
	elif microphone_enabled:
		# Live state: "mic" with green styling
		mic_icon.text = "mic"
		mic_icon.add_theme_color_override("font_color", Color(0.3, 1.0, 0.3))  # Green
		status_label.text = "Live"
		status_label.add_theme_color_override("font_color", Color(0.3, 1.0, 0.3, 0.9))  # Green
		
		# Green button style for active state
		var active_style = StyleBoxFlat.new()
		active_style.bg_color = Color(0.3, 0.8, 0.3, 0.2)  # Green tint
		active_style.corner_radius_top_left = 15
		active_style.corner_radius_top_right = 15
		active_style.corner_radius_bottom_left = 15
		active_style.corner_radius_bottom_right = 15
		mic_button.add_theme_stylebox_override("normal", active_style)
		
		# Add subtle pulsing effect to show it's live
		mic_icon.modulate.a = 1.0
		var tween = create_tween()
		tween.set_loops()
		tween.tween_property(mic_icon, "modulate:a", 0.7, 1.0)
		tween.tween_property(mic_icon, "modulate:a", 1.0, 1.0)
		
	else:
		# Disabled state: "mic" with default styling
		mic_icon.text = "mic"
		mic_icon.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))  # Gray
		status_label.text = "Off"
		status_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7, 0.8))  # Gray
		mic_icon.modulate.a = 1.0  # Stop any pulsing
		
		# Default button style for disabled state
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
	
	# Handle spacebar toggle for microphone
	if Input.is_action_just_pressed("ui_accept"):
		print("UI: Spacebar pressed - toggling microphone")
		toggle_microphone()
	
	# Debug: Check if mouse is over teams button
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		var mouse_pos = get_global_mouse_position()
		if teams_button and teams_button.visible:
			var button_rect = Rect2(teams_button.global_position, teams_button.size)
			if button_rect.has_point(mouse_pos):
				print("UI: Mouse clicked on teams button area!")
	
	# Update positions if screen size changes
	_update_positions_if_needed()

func _update_positions_if_needed() -> void:
	if not glass_panel or not mic_button or not mic_icon or not status_label or not spacebar_hint_label or not teams_glass_panel or not teams_button or not teams_icon:
		return
		
	var current_screen_size = get_viewport().get_visible_rect().size
	var target_panel_pos = Vector2(current_screen_size.x - 120, current_screen_size.y - 120)
	var target_teams_panel_pos = Vector2(current_screen_size.x - 240, current_screen_size.y - 120)
	
	# Only update if position changed significantly
	if glass_panel.position.distance_to(target_panel_pos) > 5.0:
		print("UI: Updating positions for screen size: ", current_screen_size)
		glass_panel.position = target_panel_pos
		teams_glass_panel.position = target_teams_panel_pos
		mic_button.position = Vector2(current_screen_size.x - 110, current_screen_size.y - 110)
		mic_icon.position = Vector2(current_screen_size.x - 110, current_screen_size.y - 110)
		teams_button.position = Vector2(current_screen_size.x - 230, current_screen_size.y - 110)
		teams_icon.position = Vector2(current_screen_size.x - 230, current_screen_size.y - 110)
		status_label.position = Vector2(current_screen_size.x - 120, current_screen_size.y - 15)
		spacebar_hint_label.position = Vector2(current_screen_size.x - 120, current_screen_size.y + 5)

func _recursive_node_search(node: Node) -> void:
	"""Recursively search for voice chat node with proper methods"""
	if voice_chat:
		return  # Already found
	
	# Check current node
	if node.has_method("set_voice_enabled") and node.has_method("get_voice_enabled"):
		print("UI: ✅ Found voice chat node via recursive search: ", node.name, " at ", node.get_path())
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

func _show_teams_modal() -> void:
	"""Show the teams selection modal"""
	print("🔍 _show_teams_modal() called")
	
	if teams_modal:
		print("❌ Teams modal already open, returning")
		return
		
	print("✅ Creating teams modal...")
	
	# Get the main client to access player teams and teleportation
	if not main_client:
		main_client = get_node("/root/Main")
		if not main_client:
			print("❌ Could not find main client!")
			return
	
	# Create modal background
	teams_modal = Control.new()
	teams_modal.name = "TeamsModal"
	teams_modal.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	teams_modal.mouse_filter = Control.MOUSE_FILTER_STOP  # Block clicks to game
	add_child(teams_modal)
	
	# Semi-transparent overlay
	var overlay = ColorRect.new()
	overlay.color = Color(0, 0, 0, 0.7)
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	teams_modal.add_child(overlay)
	
	# Modal dialog
	var dialog = Panel.new()
	dialog.size = Vector2(600, 400)
	dialog.position = Vector2(
		(teams_modal.size.x - dialog.size.x) / 2,
		(teams_modal.size.y - dialog.size.y) / 2
	)
	teams_modal.add_child(dialog)
	
	# Apply glass morphism styling to dialog
	var dialog_style = StyleBoxFlat.new()
	dialog_style.bg_color = Color(0.1, 0.1, 0.1, 0.9)
	dialog_style.corner_radius_top_left = 20
	dialog_style.corner_radius_top_right = 20
	dialog_style.corner_radius_bottom_left = 20
	dialog_style.corner_radius_bottom_right = 20
	dialog_style.border_width_left = 2
	dialog_style.border_width_right = 2
	dialog_style.border_width_top = 2
	dialog_style.border_width_bottom = 2
	dialog_style.border_color = Color(1, 1, 1, 0.3)
	dialog.add_theme_stylebox_override("panel", dialog_style)
	
	# Title
	var title = Label.new()
	title.text = "Select Team to Join"
	title.position = Vector2(20, 20)
	title.size = Vector2(560, 40)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", Color.WHITE)
	dialog.add_child(title)
	
	# Close button
	var close_button = Button.new()
	close_button.text = "✕"
	close_button.size = Vector2(40, 40)
	close_button.position = Vector2(540, 20)
	close_button.flat = true
	close_button.add_theme_font_size_override("font_size", 18)
	close_button.add_theme_color_override("font_color", Color.WHITE)
	close_button.pressed.connect(_close_teams_modal)
	dialog.add_child(close_button)
	
	# Get player's teams from the main client
	print("🔍 Getting player teams for modal...")
	var player_teams = _get_player_teams()
	print("📋 Modal received ", player_teams.size(), " teams: ", player_teams)
	
	# Create scrollable container for teams
	var scroll_container = ScrollContainer.new()
	scroll_container.position = Vector2(20, 80)
	scroll_container.size = Vector2(560, 260)
	dialog.add_child(scroll_container)
	
	var teams_list = VBoxContainer.new()
	scroll_container.add_child(teams_list)
	
	if player_teams.size() == 0:
		print("❌ No teams found - showing 'no teams' message")
		var no_teams_label = Label.new()
		no_teams_label.text = "You don't belong to any teams"
		no_teams_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		no_teams_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))
		teams_list.add_child(no_teams_label)
		
		# Add a debug test button to verify modal is working
		var test_button = Button.new()
		test_button.text = "Test Button (Debug)"
		test_button.size = Vector2(520, 50)
		test_button.pressed.connect(_close_teams_modal)
		teams_list.add_child(test_button)
		print("✅ Added debug test button")
	else:
		print("✅ Creating ", player_teams.size(), " team buttons")
		for team in player_teams:
			print("  🔘 Creating button for team: ", team.name, " (ID: ", team.id, ")")
			_create_team_button(teams_list, team)
	
	# Cancel button
	var cancel_button = Button.new()
	cancel_button.text = "Cancel"
	cancel_button.size = Vector2(100, 40)
	cancel_button.position = Vector2(250, 350)
	cancel_button.pressed.connect(_close_teams_modal)
	dialog.add_child(cancel_button)
	
	print("✅ Teams modal created successfully and added to scene tree!")
	print("✅ Modal dialog position: ", dialog.position)
	print("✅ Modal dialog size: ", dialog.size)
	print("✅ Modal visibility: ", teams_modal.visible)

func _get_player_teams() -> Array:
	"""Get the player's teams from the main client"""
	print("🔍 _get_player_teams() called")
	
	if not main_client:
		print("❌ No main_client found!")
		return []
	
	print("✅ main_client found: ", main_client.name)
	
	# Get the local player using the correct method
	var local_player = null
	if main_client.has_method("get_local_player"):
		local_player = main_client.get_local_player()
		print("✅ get_local_player() returned: ", local_player)
	else:
		print("❌ main_client doesn't have get_local_player method")
		return []
	
	if not local_player:
		print("❌ No local player found!")
		return []
	
	print("✅ Local player found: ", local_player.name if "name" in local_player else "unnamed")
	
	# Debug: print all properties of local player
	print("🔍 Local player properties:")
	if local_player.has_method("get_property_list"):
		var props = local_player.get_property_list()
		for prop in props:
			if prop.name in ["teamIds", "session_id", "name", "is_local_player"]:
				print("  - ", prop.name, ": ", local_player.get(prop.name))
	
	# Get team IDs from room state (the correct place to look)
	var team_ids = []
	
	# Get the session ID from the room - it's stored as session_id (with underscore)
	var local_session_id = null
	if "room" in main_client and main_client.room:
		if "session_id" in main_client.room:
			local_session_id = main_client.room.session_id
			print("🔍 Got session ID: ", local_session_id)
		else:
			print("❌ No session_id found in room")
	else:
		print("❌ No room found in main_client")
	
	# Get team IDs from room state using session ID
	if local_session_id and "room" in main_client and main_client.room:
		var room_state = main_client.room.state
		if room_state and "players" in room_state:
			var state_player = room_state.players.at(local_session_id)
			if state_player and "teamIds" in state_player:
				print("✅ Found teamIds in room state player: ", state_player.teamIds)
				# Convert ArraySchema to regular Array
				for i in range(state_player.teamIds.size()):
					team_ids.append(state_player.teamIds.at(i))
				print("✅ Converted team IDs: ", team_ids)
			else:
				print("❌ No teamIds found in room state player")
		else:
			print("❌ No room state or players found")
	else:
		print("❌ No local session ID found")
	
	if team_ids.size() == 0:
		print("ℹ️ Player has no team memberships")
		return []
	
	print("🎯 Processing ", team_ids.size(), " team IDs: ", team_ids)
	
	var teams = []
	
	# Get team room data to get team names
	var team_room_manager = main_client.team_room_manager
	if team_room_manager and team_room_manager.has_method("get_team_rooms"):
		var team_rooms = team_room_manager.get_team_rooms()
		print("✅ Team room manager found with ", team_rooms.size(), " rooms")
		for team_id in team_ids:
			var team_id_str = str(team_id)
			var team_room = team_rooms.get(team_id_str)
			print("🔍 Looking for team room with ID: ", team_id_str, " -> Found: ", team_room != null)
			if team_room:
				var team_name = team_room.team_name if "team_name" in team_room else ("Team " + team_id_str)
				teams.append({
					"id": team_id_str,
					"name": team_name
				})
				print("  ✅ Added team: ", team_name, " (ID: ", team_id_str, ")")
			else:
				teams.append({
					"id": team_id_str,
					"name": "Team " + team_id_str
				})
				print("  ⚠️ Team room not found, using fallback name for ID: ", team_id_str)
	else:
		print("❌ No team room manager found, using fallback names")
		# Fallback: just use team IDs
		for team_id in team_ids:
			var team_id_str = str(team_id)
			teams.append({
				"id": team_id_str,
				"name": "Team " + team_id_str
			})
			print("  ✅ Added fallback team: Team ", team_id_str)
	
	print("🎯 Final result: ", teams.size(), " teams for player: ", teams)
	
	# TEMPORARY DEBUG: Force show hardcoded teams if none found
	if teams.size() == 0:
		print("🔧 DEBUG: Forcing hardcoded teams for testing")
		teams = [
			{"id": "7", "name": "Team 7 (Debug)"},
			{"id": "10", "name": "Team 10 (Debug)"},
			{"id": "11", "name": "Team 11 (Debug)"},
			{"id": "18", "name": "Team 18 (Debug)"},
			{"id": "19", "name": "Team 19 (Debug)"}
		]
		print("🔧 DEBUG: Using hardcoded teams: ", teams)
	
	return teams

func _create_team_button(parent: Node, team: Dictionary) -> void:
	"""Create a button for a team in the modal"""
	var team_button = Button.new()
	team_button.text = team.name
	team_button.size = Vector2(520, 50)
	team_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	
	# Style the team button
	var button_style = StyleBoxFlat.new()
	button_style.bg_color = Color(0.2, 0.2, 0.2, 0.8)
	button_style.corner_radius_top_left = 10
	button_style.corner_radius_top_right = 10
	button_style.corner_radius_bottom_left = 10
	button_style.corner_radius_bottom_right = 10
	
	var button_hover = StyleBoxFlat.new()
	button_hover.bg_color = Color(0.3, 0.3, 0.3, 0.9)
	button_hover.corner_radius_top_left = 10
	button_hover.corner_radius_top_right = 10
	button_hover.corner_radius_bottom_left = 10
	button_hover.corner_radius_bottom_right = 10
	
	team_button.add_theme_stylebox_override("normal", button_style)
	team_button.add_theme_stylebox_override("hover", button_hover)
	team_button.add_theme_color_override("font_color", Color.WHITE)
	
	# Connect to teleport function
	team_button.pressed.connect(_teleport_to_team.bind(team.id))
	
	parent.add_child(team_button)

func _teleport_to_team(team_id: String) -> void:
	"""Teleport the player to the specified team room"""
	print("Teleporting to team: ", team_id)
	
	if not main_client:
		print("❌ No main client found!")
		return
	
	# Get the team room manager
	var team_room_manager = main_client.team_room_manager
	if not team_room_manager:
		print("❌ No team room manager found!")
		return
	
	# Get the team room position
	if team_room_manager.has_method("get_team_rooms"):
		var team_rooms = team_room_manager.get_team_rooms()
		var team_room = team_rooms.get(team_id)
		if team_room:
			# Get the center position of the team room
			var center_x = team_room.room_center.x if "room_center" in team_room else team_room.global_position.x
			var center_y = team_room.room_center.y if "room_center" in team_room else team_room.global_position.y
			
			# Teleport the local player
			var local_player = null
			if main_client.has_method("get_local_player"):
				local_player = main_client.get_local_player()
			
			if local_player:
				local_player.global_position = Vector2(center_x, center_y)
				print("✅ Teleported to team ", team_id, " at position (", center_x, ", ", center_y, ")")
			else:
				print("❌ No local player found for teleportation!")
		else:
			print("❌ Team room not found for team ", team_id)
	else:
		print("❌ Team room manager doesn't have get_team_rooms method")
	
	# Close the modal
	_close_teams_modal()

func _close_teams_modal() -> void:
	"""Close the teams modal"""
	if teams_modal:
		teams_modal.queue_free()
		teams_modal = null
		print("Teams modal closed")
