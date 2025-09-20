extends Node2D

@export var sprite_path: NodePath     # set this in the Inspector
@onready var sprite: AnimatedSprite2D = %AstronautSprite


func _ready() -> void:
	assert(sprite != null, "AnimatedSprite2D not found at sprite_path. Set it in the Inspector.")

func update_from_velocity(v: Vector2) -> void:
	if sprite == null: return
	if v.length() < 0.1:
		sprite.stop()
		sprite.frame = 0
		return
	var dir := "down"
	if abs(v.x) > abs(v.y):
		dir = "right" if v.x > 0.0 else "left"
	else:
		dir = "down" if v.y > 0.0 else "up"
	var anim := "walk_" + dir
	if sprite.animation != anim or not sprite.is_playing():
		sprite.play(anim)

func set_pos(x: float, y: float) -> void:
	global_position = Vector2(x, y)
