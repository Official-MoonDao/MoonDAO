extends Area2D
class_name Interactable

@export var prompt: String = "Interact"
signal interacted(by: Node)

var _hover := false

func _ready() -> void:
	input_pickable = true
	mouse_entered.connect(func(): _hover = true)
	mouse_exited.connect(func(): _hover = false)

func _unhandled_input(event: InputEvent) -> void:
	if _hover and event.is_action_pressed("ui_accept"):
		emit_signal("interacted", get_tree().get_first_node_in_group("player"))

func _process(_dt: float) -> void:
	var s := $Sprite2D
	if s:
		s.modulate = Color(1,1,1,1) if _hover else Color(0.9,0.9,0.9,1)
