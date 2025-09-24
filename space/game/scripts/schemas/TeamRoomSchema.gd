extends "res://addons/godot_colyseus/lib/schema.gd"
class_name TeamRoomSchema

static func define_fields():
	return [
		Field.new("teamId", Field.Types.STRING),
		Field.new("teamName", Field.Types.STRING),
		Field.new("teamImage", Field.Types.STRING),
		Field.new("centerX", Field.Types.NUMBER),
		Field.new("centerY", Field.Types.NUMBER),
		Field.new("width", Field.Types.NUMBER),
		Field.new("height", Field.Types.NUMBER),
		Field.new("allowedPlayers", Field.Types.ARRAY, "string"),
	]
