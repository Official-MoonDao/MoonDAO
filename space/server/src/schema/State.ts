import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
}

export class RoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
