import { Server, matchMaker, LocalPresence } from "@colyseus/core";
import { WebSocketTransport, WebSocketClient } from "@colyseus/ws-transport";
import url from "url";
import querystring from "querystring";
import { Lobby } from "./rooms/Lobby";

class DebugWsTransport extends WebSocketTransport {
  async onConnection(rawClient: any, req: any) {
    // mirror base transport behavior, but use our own seat check to avoid cross-instance mismatch
    (rawClient as any).on("error", (err: any) => {
      const e = err && err.stack ? err : new Error(String(err));
      // eslint-disable-next-line no-console
      console.error(e);
    });
    (rawClient as any).on("pong", function heartbeat(this: any) {
      this.pingCount = 0;
    });

    const upgradeReq: any = req || (rawClient as any).upgradeReq;
    const parsedURL = url.parse(upgradeReq?.url ?? "");
    const sessionId = (querystring.parse(parsedURL.query as any) as any)
      .sessionId as string;
    const match = (parsedURL.pathname as string).match(
      /\/[a-zA-Z0-9_\-]+\/([a-zA-Z0-9_\-]+)$/
    );
    const roomId = match && match[1];
    let room = (matchMaker as any).getRoomById?.(roomId);

    // Wait briefly for reservation to be registered
    let attempts = 0;
    while (attempts < 50 && (!room || !room.hasReservedSeat(sessionId))) {
      await new Promise((r) => setTimeout(r, 10));
      room = (matchMaker as any).getRoomById?.(roomId);
      attempts++;
    }

    // eslint-disable-next-line no-console
    console.log(
      "WS onConnection:",
      upgradeReq?.url,
      "roomId=",
      roomId,
      "sessionId=",
      sessionId,
      "room?",
      !!room,
      "hasReservedSeat?",
      room ? room.hasReservedSeat(sessionId) : undefined,
      "attempts=",
      attempts
    );

    const client = new WebSocketClient(sessionId, rawClient);
    try {
      if (!room || !room.hasReservedSeat(sessionId)) {
        throw new Error("seat reservation expired.");
      }
      await (room as any)._onJoin(client, upgradeReq);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      // send error code to client then terminate
      (client as any).error(
        (e && e.code) || 0,
        e && e.message ? e.message : String(e),
        () => (rawClient as any).close(1000)
      );
    }
  }
}

const transport = new DebugWsTransport();

const gameServer = new Server({
  transport,
  presence: new LocalPresence(), // ensure in-process presence
});

// Seat TTL (seconds) on the global matchmaker (not used by 0.14 for seats, kept for reference)
(matchMaker as any).seatReservationTimeToLive = 120;

gameServer.define("lobby", Lobby);

const PORT = Number(process.env.PORT ?? 2567);
gameServer
  .listen(PORT)
  .then(() => console.log(`Colyseus listening on :${PORT}`));

// Debug upgrades to ensure ROOT path & subprotocol
// (cast because ws types may differ depending on transport options)
(transport.server as any)?.on("upgrade", (req: any) => {
  console.log(
    "WS upgrade:",
    req.url,
    "protocol:",
    req.headers["sec-websocket-protocol"]
  );
});
console.log(
  "seatReservationTimeToLive:",
  (matchMaker as any).seatReservationTimeToLive
);
if (process.env.COLYSEUS_SEAT_RESERVATION_TIME) {
  console.log(
    "COLYSEUS_SEAT_RESERVATION_TIME:",
    process.env.COLYSEUS_SEAT_RESERVATION_TIME
  );
}
