import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type(["string"]) teamIds = new ArraySchema<string>();
  @type("string") currentTeamRoom = "";
  @type("string") currentVoiceRoom = "lobby"; // LiveKit voice room // Which team room the player is currently in (empty if in main lobby)
}

export class TeamRoom extends Schema {
  @type("string") teamId = "";
  @type("string") teamName = "";
  @type("string") teamImage = "";
  @type("number") centerX = 0;
  @type("number") centerY = 0;
  @type("number") width = 200;
  @type("number") height = 200;
  @type(["string"]) allowedPlayers = new ArraySchema<string>(); // sessionIds of players allowed in this room
}

export class RoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: TeamRoom }) teamRooms = new MapSchema<TeamRoom>();
  @type(["string"]) validTeamIds = new ArraySchema<string>(); // All valid team IDs from the API
}
