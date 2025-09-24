extends Node2D

@export var sprite_path: NodePath     # set this in the Inspector
@onready var sprite: AnimatedSprite2D = $AstronautSprite


func _ready() -> void:
	assert(sprite != null, "AnimatedSprite2D not found at sprite_path. Set it in the Inspector.")

func update_from_velocity(v: Vector2) -> void:
	if sprite == null: return
	if v.length() < 0.1:
		sprite.stop()
		sprite.frame = 0
		sprite.flip_h = false  # Reset flip when idle
		return
	
	var dir := "down"
	var should_flip := false
	
	if abs(v.x) > abs(v.y):
		if v.x > 0.0:
			dir = "right"
			should_flip = false
		else:
			dir = "left"
			should_flip = true
	else:
		dir = "down" if v.y > 0.0 else "up"
		should_flip = false
	
	# Use right-facing animation for left movement, but flip it
	var anim := "walk_" + (dir if dir != "left" else "right")
	sprite.flip_h = should_flip
	
	if sprite.animation != anim or not sprite.is_playing():
		sprite.play(anim)

func set_pos(x: float, y: float) -> void:
	global_position = Vector2(x, y)

func set_animation_speed(speed_multiplier: float) -> void:
	"""Set the animation speed multiplier for walking/sprinting"""
	if sprite == null: return
	
	# Base speed scale is 3.0 (from the scene), multiply by sprint factor
	var base_speed = 3.0
	sprite.speed_scale = base_speed * speed_multiplier
