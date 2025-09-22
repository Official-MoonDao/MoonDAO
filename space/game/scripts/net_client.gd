extends Node

# Adjust these paths to match your project layout:
const ColyseusInit: GDScript = preload("res://addons/godot_colyseus/init.gd")
const RoomStateSchema: GDScript = preload("res://scripts/schemas/RoomStateSchema.gd")

@export var server_url: String = "wss://moondao-space-server.fly.dev"
# @export var server_url: String = "ws://localhost:2567"
@export var room_name: String = "lobby"

var jwt_token: String = ""
var colyseus: Object = null
var client: Object = null
var room: Object = null

func _ready() -> void:
	# Pull JWT from URL if present (HTML5 builds)
	var hash: String = JavaScriptBridge.eval("window.location.hash || ''")
	if hash != "" and hash.begins_with("#token="):
		jwt_token = hash.substr(7)

	colyseus = ColyseusInit.new()
	client = colyseus.Client.new(server_url)

	var opts: Variant = JavaScriptBridge.create_object("Object") # (JavaScriptObject at runtime)
	opts.token = jwt_token

	var promise = client.join_or_create(RoomStateSchema, room_name, opts)
	await promise.completed
	if promise.get_state() == promise.State.Failed:
		push_error("Join failed: %s" % promise.get_error_string())
		return

	room = promise.get_result()
	room.on_state_change(self, "_on_state_change")

func _on_state_change(state) -> void:
	for sid in state.players.keys():
		var p = state.players[sid]  # PlayerSchema
		print("Player:", p.id, p.name, "at", p.x, p.y)
