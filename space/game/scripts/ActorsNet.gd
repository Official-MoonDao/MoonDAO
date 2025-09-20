extends Node2D

const ColyseusInit: GDScript    = preload("res://addons/godot_colyseus/init.gd")
const RoomStateSchema: GDScript = preload("res://scripts/schemas/RoomStateSchema.gd")
const PlayerScene: PackedScene  = preload("res://scenes/Player.tscn")

@export var server_url: String = "ws://127.0.0.1:2567"
@export var room_name: String  = "lobby"

var jwt_token: String = ""
var colyseus: Object = null
var client: Object = null
var room: Object = null

# sessionId -> Player instance
var players: Dictionary = {}

func _ready() -> void:
	# Get JWT from URL (HTML5), else empty
	var hash: String = ""
	if Engine.has_singleton("JavaScriptBridge"):
		hash = JavaScriptBridge.eval("window.location.hash || ''")
	if hash != "" and hash.begins_with("#token="):
		jwt_token = hash.substr(7)

	# Connect to Colyseus
	colyseus = ColyseusInit.new()
	client   = colyseus.Client.new(server_url)

	var opts: Variant = {}
	if Engine.has_singleton("JavaScriptBridge"):
		opts = JavaScriptBridge.create_object("Object")
	opts.token = jwt_token

	var promise = client.join_or_create(RoomStateSchema, room_name, opts)
	await promise.completed
	if promise.get_state() == promise.State.Failed:
		push_error("Join failed: %s" % promise.get_error_string())
		return

	room = promise.get_result()
	room.on_state_change(self, "_on_state_change")

func _on_state_change(state) -> void:
	# Add or update players
	for sid in state.players.keys():
		var p = state.players[sid]  # PlayerSchema
		if not players.has(sid):
			var inst: Node2D = PlayerScene.instantiate()
			if inst.has_variable("fill_color"):
				inst.fill_color = Color(randf(), 0.7, 1.0)
			add_child(inst)
			players[sid] = inst
			if inst.has_method("set_name_text"):
				inst.set_name_text(p.name)
		var node: Node2D = players[sid]
		if node.has_method("set_pos"):
			node.set_pos(p.x, p.y)

	# Remove departed players
	var to_remove: Array = []
	for sid in players.keys():
		if not state.players.has(sid):
			to_remove.append(sid)
	for dead in to_remove:
		var n: Node = players[dead]
		if is_instance_valid(n):
			n.queue_free()
		players.erase(dead)

# OPTIONAL: send simple movement (WASD/Arrow keys)
func _process(_dt: float) -> void:
	if room == null:
		return
	var v := Vector2.ZERO
	if Input.is_action_pressed("ui_right"): v.x += 1
	if Input.is_action_pressed("ui_left"):  v.x -= 1
	if Input.is_action_pressed("ui_down"):  v.y += 1
	if Input.is_action_pressed("ui_up"):    v.y -= 1
	if v != Vector2.ZERO:
		room.send("move", {"x": v.x * 4.0, "y": v.y * 4.0})
