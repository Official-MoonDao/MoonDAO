# res://scripts/MainNetClient.gd
extends Node2D

@export var server_url: String = "ws://127.0.0.1:2567"
@export var room_name: String  = "lobby"

const PLAYER_SCENE_PATH        := "res://scenes/Player.tscn"
const ROOM_STATE_SCHEMA_PATH   := "res://scripts/schemas/RoomStateSchema.gd"

# Only the runtime client (NOT the editor plugin)
const COLYSEUS_CLIENT_PATHS := [
	"res://addons/godot_colyseus/lib/client.gd"
]

var client: Object = null
var room: Object = null
var players: Dictionary = {}   # sessionId -> Player instance
var last_pos: Dictionary = {}  # sessionId -> Vector2 (for anim velocity)

@onready var actors: Node2D = $Actors
@onready var cam: Camera2D = _ensure_camera()
var _follow: Node2D = null     # local player to follow

# Fallbacks to ensure you SEE something
var _dummy_timer := 0.0
var _dummy_spawned := false

func _ready() -> void:
	# --- 1) Actors container sanity
	if actors == null:
		push_error("MainNetClient: Missing child node 'Actors' (Node2D). Create it under Main and enable Y Sort.")
		return
	actors.y_sort_enabled = true

	# --- 2) Connect to Colyseus
	var url := _build_url_with_token(server_url)
	print("MainNetClient: connecting to ", url, " room=", room_name)

	client = _new_client(url)
	if client == null:
		push_error("MainNetClient: Could not construct Colyseus client. Check addon path under 'addons/godot_colyseus/'.")
		return

	var ROOM_STATE_SCHEMA_REF: GDScript = preload(ROOM_STATE_SCHEMA_PATH)

	var opts: Dictionary = {}
	var promise = client.join_or_create(ROOM_STATE_SCHEMA_REF, room_name, opts)
	await promise.completed
	if promise.get_state() == promise.State.Failed:
		push_error("Join failed: %s" % promise.get_error_string())
		return

	room = promise.get_result()
	room.on_state_change(self, "_on_state_change")
	print("MainNetClient: joined room: ", room_name)

func _process(delta: float) -> void:
	# Spawn a guaranteed dummy after 1s if we haven't seen any server players.
	if not _dummy_spawned:
		_dummy_timer += delta
		if _dummy_timer > 1.0 and players.size() == 0:
			_spawn_dummy_player()
			_dummy_spawned = true
			print("MainNetClient: spawned local dummy so you can see something.")

	# Optional: local input → server "move" intents
	if room != null:
		var v := Vector2.ZERO
		if Input.is_action_pressed("ui_right"):
			v.x += 1
		if Input.is_action_pressed("ui_left"):
			v.x -= 1
		if Input.is_action_pressed("ui_down"):
			v.y += 1
		if Input.is_action_pressed("ui_up"):
			v.y -= 1
		if v != Vector2.ZERO:
			room.send("move", {"x": v.x * 4.0, "y": v.y * 4.0})

	# Smooth-follow the local player with the camera
	if _follow != null and cam != null:
		cam.global_position = cam.global_position.lerp(_follow.global_position, 0.2)

func _on_state_change(state) -> void:
	print("State change: players=", state.players.size())

	# Add / update players
	for sid in state.players.keys():
		var p = state.players[sid]
		if not players.has(sid):
			var inst_ps: PackedScene = preload(PLAYER_SCENE_PATH)
			var inst: Node2D = inst_ps.instantiate()
			actors.add_child(inst)
			players[sid] = inst

			# If your Player scene supports a name label
			if inst.has_method("set_name_text"):
				var nm := ""
				if ("name" in p) and (p.name is String):
					nm = p.name
				inst.set_name_text(nm)

			# Follow our own player
			if room != null and sid == room.session_id:
				_follow = inst

		var node: Node2D = players[sid]
		var prev: Vector2 = node.global_position
		if last_pos.has(sid) and last_pos[sid] is Vector2:
			prev = last_pos[sid]

		var next := Vector2.ZERO
		if ("x" in p) and ("y" in p):
			next = Vector2(float(p.x), float(p.y))

		if node.has_method("set_pos"):
			node.set_pos(next.x, next.y)
		else:
			node.global_position = next

		if node.has_method("update_from_velocity"):
			node.update_from_velocity(next - prev)

		last_pos[sid] = next

	# Remove those not present anymore
	var to_remove: Array = []
	for existing_sid in players.keys():
		if not state.players.has(existing_sid):
			to_remove.append(existing_sid)
	for dead in to_remove:
		var n: Node = players[dead]
		if is_instance_valid(n):
			n.queue_free()
		players.erase(dead)
		last_pos.erase(dead)
	if _follow != null and not players.values().has(_follow):
		_follow = null

# --------- helpers ---------

func _new_client(url: String):
	for p in COLYSEUS_CLIENT_PATHS:
		var s := load(p)
		if s != null:
			var c = s.new(url)
			if c != null:
				return c
	return null

func _build_url_with_token(base_url: String) -> String:
	var token := ""
	if Engine.has_singleton("JavaScriptBridge"):
		var j: Variant = JavaScriptBridge.eval("(window && window.location && window.location.hash) ? String(window.location.hash) : ''")
		if (j is String) and j.begins_with("#token=") and j.length() > 7:
			token = j.substr(7)
	if token == "":
		return base_url
	var sep := "?"
	if base_url.find("?") != -1:
		sep = "&"
	return base_url + sep + "token=" + token.uri_encode()

func _spawn_dummy_player() -> void:
	var ps: PackedScene = preload(PLAYER_SCENE_PATH)
	if ps == null:
		push_error("MainNetClient: Could not load Player.tscn at " + PLAYER_SCENE_PATH)
		return
	var inst: Node2D = ps.instantiate()
	actors.add_child(inst)
	if inst.has_method("set_name_text"):
		inst.set_name_text("Local Dummy")
	# place near center so camera can find it until server state arrives
	var center := get_viewport_rect().size * 0.5
	if inst.has_method("set_pos"):
		inst.set_pos(center.x, center.y)
	else:
		inst.global_position = center
	# follow the dummy until the server spawns the real player
	if _follow == null:
		_follow = inst

func _ensure_camera() -> Camera2D:
	var c := get_node_or_null("Camera2D") as Camera2D
	if c == null:
		c = Camera2D.new()
		c.name = "Camera2D"
		add_child(c)

	# make it active and smooth
	c.make_current()
	c.position_smoothing_enabled = true
	c.position_smoothing_speed = 10.0
	# Optional zoom or limits can go here
	return c
