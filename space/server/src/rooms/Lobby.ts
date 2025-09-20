import { Room, Client } from "@colyseus/core";
import { RoomState, Player } from "../schema/State";
import { z } from "zod";
import { jwtVerify } from "jose";

const MoveMsg = z.object({ x: z.number(), y: z.number() });

export class Lobby extends Room<RoomState> {
  maxClients = 64;

  async onCreate(options: any) {
    this.setState(new RoomState());

    this.onMessage("move", (client, payload) => {
      const { x, y } = MoveMsg.parse(payload);
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      // (Server-authoritative clamp/speed checks go here)
      p.x = x;
      p.y = y;
    });
  }

  async onAuth(client: Client, options: any, request: any) {
    // Accept JWT passed via query (?token=...) or header
    const token =
      options?.token ||
      new URL(request.url!, "http://x").searchParams.get("token");
    if (!token) return false;
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.JWT_SECRET!)
      );
      (client as any).user = {
        id: payload.sub,
        name: payload.name ?? payload.wallet ?? "Anon",
      };
      return true;
    } catch {
      return false;
    }
  }

  onJoin(client: Client) {
    const user = (client as any).user;
    const p = new Player();
    p.id = String(user.id);
    p.name = user.name;
    this.state.players.set(client.sessionId, p);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }
}
