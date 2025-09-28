# res://scripts/MobileTestHelper.gd
# Helper script for testing mobile features
extends Node

func _ready() -> void:
	print("=== Mobile Test Helper ===")
	print("Press F1 to toggle mobile mode")
	print("Press F2 to enable mobile mode")
	print("Press F3 to disable mobile mode")
	print("Press F4 to show current config")

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_F1:
				GameConfig.toggle_mobile_mode()
				_show_config()
			KEY_F2:
				GameConfig.set_mobile_mode(true)
				_show_config()
			KEY_F3:
				GameConfig.set_mobile_mode(false)
				_show_config()
			KEY_F4:
				_show_config()

func _show_config() -> void:
	print("=== Current GameConfig ===")
	print("Mobile mode: ", GameConfig.is_mobile())
	print("Joystick config: ", GameConfig.get_joystick_config())
	print("Minimap config: ", GameConfig.get_minimap_config())
	print("Touch config: ", GameConfig.get_touch_config())
	print("==========================")
