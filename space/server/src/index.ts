import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import { Lobby } from "./rooms/Lobby";

const httpServer = createServer();
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("lobby", Lobby);

const PORT = Number(process.env.PORT ?? 2567);
httpServer.listen(PORT, () => console.log(`Colyseus listening on :${PORT}`));
