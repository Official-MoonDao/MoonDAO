extends "res://addons/godot_colyseus/lib/schema.gd"
class_name RoomStateSchema

const PlayerSchemaRef: GDScript = preload("res://scripts/schemas/PlayerSchema.gd")
const TeamRoomSchemaRef: GDScript = preload("res://scripts/schemas/TeamRoomSchema.gd")

static func define_fields():
	return [
		# Map of sessionId -> PlayerSchema
		Field.new("players", Field.Types.MAP, PlayerSchemaRef),
		# Map of teamId -> TeamRoomSchema
		Field.new("teamRooms", Field.Types.MAP, TeamRoomSchemaRef),
		# Array of valid team IDs
		Field.new("validTeamIds", Field.Types.ARRAY, "string"),
	]
