extends Node2D
@export var speed := 140.0
@onready var view: Node2D = $Astronaut

func _process(delta: float) -> void:
	var v := Vector2(
		Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
		Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	) * speed * delta

	position += v
	if view.has_method("update_from_velocity"):
		view.update_from_velocity(v / delta)  # convert back to velocity
