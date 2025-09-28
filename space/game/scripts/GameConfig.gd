# Master configuration for the game
extends Node

# Mobile/Platform Settings
var force_mobile_mode: bool = false  # Set to true to test mobile features on desktop
var auto_detect_mobile: bool = true

# Mobile UI Settings
var joystick_enabled: bool = true
var joystick_size: Vector2 = Vector2(200, 200) 
var joystick_radius: float = 90.0 
var joystick_deadzone: float = 0.2
var joystick_sprint_threshold: float = 0.95

# Minimap Settings
var minimap_top_left_on_mobile: bool = true
var minimap_size: Vector2 = Vector2(220, 220)

# Touch/Input Settings
var pinch_zoom_enabled: bool = true
var touch_sensitivity: float = 1.0

# Debug Settings
var debug_mobile_detection: bool = true
var debug_joystick: bool = false
var debug_minimap: bool = false

func _ready() -> void:
	print("GameConfig: Initialized")
	if debug_mobile_detection:
		print("GameConfig: Platform: ", OS.get_name())
		print("GameConfig: Force mobile mode: ", force_mobile_mode)
		print("GameConfig: Is mobile: ", is_mobile())

func is_mobile() -> bool:
	"""Check if we should use mobile features"""
	if force_mobile_mode:
		return true
	
	if auto_detect_mobile:
		var platform = OS.get_name()
		return platform in ["Android", "iOS"]
	
	return false

func get_joystick_config() -> Dictionary:
	"""Get joystick configuration"""
	return {
		"enabled": joystick_enabled and is_mobile(),
		"size": joystick_size,
		"radius": joystick_radius,
		"deadzone": joystick_deadzone,
		"sprint_threshold": joystick_sprint_threshold
	}

func get_minimap_config() -> Dictionary:
	"""Get minimap configuration"""
	return {
		"size": minimap_size,
		"top_left_on_mobile": minimap_top_left_on_mobile,
		"is_mobile": is_mobile()
	}

func get_touch_config() -> Dictionary:
	"""Get touch input configuration"""
	return {
		"pinch_zoom_enabled": pinch_zoom_enabled and is_mobile(),
		"sensitivity": touch_sensitivity
	}

# Quick toggle functions for testing
func toggle_mobile_mode() -> void:
	"""Toggle mobile mode for testing"""
	force_mobile_mode = !force_mobile_mode
	print("GameConfig: Mobile mode toggled to: ", force_mobile_mode)
	# Notify other systems about the change
	get_tree().call_group("mobile_ui", "_on_mobile_config_changed")

func set_mobile_mode(enabled: bool) -> void:
	"""Set mobile mode explicitly"""
	force_mobile_mode = enabled
	print("GameConfig: Mobile mode set to: ", force_mobile_mode)
	# Notify other systems about the change
	get_tree().call_group("mobile_ui", "_on_mobile_config_changed")
