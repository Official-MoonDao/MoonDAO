import { Client } from "colyseus.js";

const endpoint = process.env.COLYSEUS_ENDPOINT || "ws://localhost:2567";
const roomName = process.env.COLYSEUS_ROOM || "lobby";

async function main() {
  const client = new Client(endpoint);
  try {
    const room = await client.joinOrCreate(roomName, {});
    console.log("Joined room:", { id: room.id, sessionId: room.sessionId });
    // send a ping-like message using schema sync only; wait briefly
    await new Promise((r) => setTimeout(r, 1000));
    await room.leave();
    console.log("Left room");
    process.exit(0);
  } catch (err) {
    console.error("Failed to join room:", err?.message || err);
    process.exit(1);
  }
}

main();
