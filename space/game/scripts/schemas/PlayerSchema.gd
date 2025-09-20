extends "res://addons/godot_colyseus/lib/schema.gd"
class_name PlayerSchema

static func define_fields():
	return [
		Field.new("id",   Field.Types.STRING),
		Field.new("name", Field.Types.STRING),
		Field.new("x",    Field.Types.NUMBER),
		Field.new("y",    Field.Types.NUMBER),
	]
