extends "res://addons/godot_colyseus/lib/schema.gd"
class_name RoomStateSchema

const PlayerSchemaRef: GDScript = preload("res://scripts/schemas/PlayerSchema.gd")

static func define_fields():
	return [
		# Map of sessionId -> PlayerSchema
		Field.new("players", Field.Types.MAP, PlayerSchemaRef),
	]
