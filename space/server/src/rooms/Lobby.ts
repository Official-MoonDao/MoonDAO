import { Room, Client } from "@colyseus/core";
import { RoomState, Player } from "../schema/State";
import { z } from "zod";
import jwt from "jsonwebtoken";

const MoveMsg = z.object({ x: z.number(), y: z.number() });

export class Lobby extends Room<RoomState> {
  maxClients = 64;
  private activeUserSessions = new Map<string, string>(); // userId -> sessionId mapping

  async onCreate(options: any) {
    this.setState(new RoomState());
    // Extend seat reservation TTL to avoid early expiration during WebSocket upgrade in dev
    try {
      (this as any).setSeatReservationTime?.(300);
      console.log(
        "Lobby onCreate: seatReservationTime=",
        (this as any).seatReservationTime
      );
    } catch {}

    this.onMessage("move", (client, payload) => {
      const { x, y } = MoveMsg.parse(payload);
      const p = this.state.players.get(client.sessionId);
      if (!p) return;

      // Apply movement delta to player position
      p.x += x;
      p.y += y;

      // Optional: clamp to world bounds (allow negative coordinates)
      p.x = Math.max(-2000, Math.min(p.x, 2000));
      p.y = Math.max(-2000, Math.min(p.y, 2000));

      // Debug logging (remove after testing)
      if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
        console.log(
          `Player ${client.sessionId} moved by (${x.toFixed(2)}, ${y.toFixed(
            2
          )}) to (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`
        );

        // Special logging for movements from/near spawn
        if (Math.abs(p.x) < 50 || Math.abs(p.y) < 50) {
          console.log(
            `*** SPAWN AREA MOVEMENT *** Player near origin: (${p.x.toFixed(
              2
            )}, ${p.y.toFixed(2)})`
          );
        }
      }
    });

    this.onMessage("voice_data", (client, payload) => {
      try {
        console.log(
          "Voice data received from",
          client.sessionId,
          "payload:",
          typeof payload,
          "keys:",
          Object.keys(payload)
        );

        // DEBUG: Check what client actually sent
        if (payload.frames) {
          console.log(
            `🔊 CLIENT SENT - Frame count: ${
              payload.frames.length
            }, Frame type: ${typeof payload.frames[0]}`
          );
          if (payload.frames.length > 0) {
            console.log(`🔊 First frame from client:`, payload.frames[0]);

            // Check frame data quality on server side
            let maxAmp = 0;
            let nonZeroFrames = 0;
            for (let i = 0; i < Math.min(10, payload.frames.length); i++) {
              const frame = payload.frames[i];
              if (Array.isArray(frame) && frame.length >= 2) {
                const amp = Math.max(Math.abs(frame[0]), Math.abs(frame[1]));
                if (amp > maxAmp) maxAmp = amp;
                if (amp > 0) nonZeroFrames++;
              }
            }
            console.log(
              `🔊 CLIENT AUDIO QUALITY - Max amplitude: ${maxAmp.toFixed(
                6
              )}, Non-zero frames: ${nonZeroFrames}/10`
            );
          }
        }

        // Handle both formats: legacy bytes and new frames
        if (!payload || (!payload.data && !payload.frames)) {
          console.error("Voice data missing - no data or frames field");
          return;
        }

        const { data, frames, sample_rate, format, chunk_info } = payload;

        // Broadcast voice data to all other clients with the sender's session ID
        const broadcastPayload: any = {
          session_id: client.sessionId,
          sample_rate: sample_rate || 22050,
          format: format || "bytes",
        };

        // Include chunk info if present (for chunked transmission)
        if (chunk_info) {
          broadcastPayload.chunk_info = chunk_info;
          console.log(
            `🔊 Broadcasting chunk ${chunk_info.chunk_index + 1}/${
              chunk_info.total_chunks
            } from ${client.sessionId}`
          );
        }

        // Include the appropriate data field
        if (
          (format === "frames" ||
            format === "frames_highprec" ||
            format === "frames_direct") &&
          frames
        ) {
          // For frames_direct, frames is already a simple array of floats (mono)
          if (format === "frames_direct") {
            broadcastPayload.frames = [...frames]; // Simple copy for mono float array
            console.log(
              "Broadcasting direct frames data from",
              client.sessionId,
              "- sample count:",
              frames.length
            );
          } else {
            // IMPORTANT: Deep copy frames to prevent reference issues (for stereo frames)
            broadcastPayload.frames = JSON.parse(JSON.stringify(frames));
            console.log(
              "Broadcasting frames data from",
              client.sessionId,
              "- frame count:",
              frames.length
            );
          }

          // DEBUG: Check frame data quality
          let maxAmplitude = 0;
          let nonZeroCount = 0;
          for (let i = 0; i < Math.min(10, frames.length); i++) {
            const frame = frames[i];
            let amplitude = 0;

            if (format === "frames_direct") {
              // Direct frames are mono floats
              amplitude = Math.abs(frame);
            } else if (Array.isArray(frame) && frame.length >= 2) {
              // Regular frames are stereo arrays
              amplitude = Math.max(Math.abs(frame[0]), Math.abs(frame[1]));
            }

            if (amplitude > maxAmplitude) maxAmplitude = amplitude;
            if (amplitude > 0) nonZeroCount++;
          }
          console.log(
            `🔊 SERVER FRAME DEBUG - Max amplitude: ${maxAmplitude}, Non-zero frames: ${nonZeroCount}/${Math.min(
              10,
              frames.length
            )}`
          );
          if (frames.length > 0) {
            console.log(
              `🔊 First few frames:`,
              frames.slice(0, Math.min(3, frames.length))
            );
          }

          // Compare original vs broadcast frames to check for corruption
          const broadcastFrames = broadcastPayload.frames;
          let corruptionDetected = false;
          for (let i = 0; i < Math.min(5, frames.length); i++) {
            if (
              JSON.stringify(frames[i]) !== JSON.stringify(broadcastFrames[i])
            ) {
              corruptionDetected = true;
              break;
            }
          }
          console.log(
            `🔊 BROADCAST INTEGRITY - Corruption detected: ${corruptionDetected}`
          );
        } else if (data) {
          broadcastPayload.data = data;
          console.log(
            "Broadcasting byte data from",
            client.sessionId,
            "- size:",
            data.length || data.byteLength || "unknown"
          );
        } else {
          console.error("No valid data field found");
          return;
        }

        this.broadcast("voice_data", broadcastPayload, { except: client });

        // Log appropriate data size based on format
        let dataSize = "unknown";
        if (format === "frames" && frames) {
          dataSize = `${frames.length} frames`;
        } else if (data) {
          dataSize =
            data instanceof ArrayBuffer
              ? `${data.byteLength} bytes`
              : `${data.length || data.byteLength || "unknown"} bytes`;
        }

        console.log(`Voice data from ${client.sessionId}, size: ${dataSize}`);
      } catch (error) {
        console.error("Error processing voice data:", error);
      }
    });
  }

  async onAuth(client: Client, options: any, request: any) {
    // Accept JWT passed via query (?token=...) or options, but do not require it in dev
    const urlToken = new URL(request.url!, "http://x").searchParams.get(
      "token"
    );
    const optToken = options?.token;
    const token = optToken || urlToken;
    let userId = "";
    let userName = "Anon";

    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!);
        const sub = (payload as any)?.sub ?? "";
        const name =
          (payload as any)?.name ?? (payload as any)?.wallet ?? "Anon";
        userId = String(sub);
        userName = name;
        console.log("on Auth ok", payload);
      } catch (e) {
        console.warn("JWT verify failed, falling back to anon user");
        // Fallback: allow connection without token (dev) – identify by sessionId
        userId = client.sessionId;
        userName = "Anon";
      }
    } else {
      // Fallback: allow connection without token (dev) – identify by sessionId
      userId = client.sessionId;
      userName = "Anon";
    }

    // Debug logging for session tracking
    console.log(
      `🔍 AUTH DEBUG - User ID: ${userId}, Session ID: ${client.sessionId}`
    );
    console.log(
      `🔍 AUTH DEBUG - Is authenticated user: ${userId !== client.sessionId}`
    );
    console.log(
      `🔍 AUTH DEBUG - Active sessions:`,
      Array.from(this.activeUserSessions.entries())
    );
    console.log(
      `🔍 AUTH DEBUG - Has existing session for user: ${this.activeUserSessions.has(
        userId
      )}`
    );

    // Check for duplicate sessions (only for authenticated users, not anon)
    if (userId !== client.sessionId && this.activeUserSessions.has(userId)) {
      const existingSessionId = this.activeUserSessions.get(userId)!;
      console.log(`🔍 AUTH DEBUG - Existing session ID: ${existingSessionId}`);

      const existingClient = this.clients.find(
        (c) => c.sessionId === existingSessionId
      );
      console.log(`🔍 AUTH DEBUG - Found existing client: ${!!existingClient}`);

      if (existingClient) {
        console.log(
          `⚠️ Duplicate session detected for user ${userId}. Rejecting NEW connection instead of old one`
        );

        // Send error message to the client before rejecting
        try {
          (client as any).send("duplicate_session_error", {
            message: "Only one session per account is allowed",
          });
        } catch (e) {
          console.log("Could not send message to client before rejection");
        }

        // Reject the NEW connection with a clear error message
        console.log(
          `🚫 Rejecting new session ${client.sessionId} - duplicate account`
        );
        return false; // This properly rejects the authentication
      } else {
        console.log(
          `⚠️ Session ${existingSessionId} not found in clients, cleaning up stale reference`
        );
        this.activeUserSessions.delete(userId);
      }
    }

    (client as any).user = { id: userId, name: userName };
    return true;
  }

  onJoin(client: Client) {
    const user = (client as any).user;
    const p = new Player();
    p.id = String(user.id);
    p.name = user.name;
    this.state.players.set(client.sessionId, p);

    // Track active session for this user (only for authenticated users, not anon)
    if (user.id !== client.sessionId) {
      this.activeUserSessions.set(user.id, client.sessionId);
      console.log(
        `✅ User ${user.id} (${user.name}) joined with session ${client.sessionId}`
      );
    } else {
      console.log(`✅ Anonymous user joined with session ${client.sessionId}`);
    }

    console.log("onJoin", client.sessionId);
    console.log("players size", this.state.players.size);
    console.log("active user sessions:", this.activeUserSessions.size);

    // (message-based sync removed; rely on schema)
  }

  onLeave(client: Client) {
    const user = (client as any).user;
    this.state.players.delete(client.sessionId);

    // Remove from active sessions tracking (only for authenticated users, not anon)
    if (user && user.id !== client.sessionId) {
      // Only remove if this session is the currently active one for this user
      if (this.activeUserSessions.get(user.id) === client.sessionId) {
        this.activeUserSessions.delete(user.id);
        console.log(
          `🚪 User ${user.id} (${user.name}) left, session ${client.sessionId} removed from tracking`
        );
      }
    } else {
      console.log(`🚪 Anonymous user left, session ${client.sessionId}`);
    }

    console.log("onLeave", client.sessionId);
    console.log("players size", this.state.players.size);
    console.log("active user sessions:", this.activeUserSessions.size);
    // (message-based sync removed)
  }
}
