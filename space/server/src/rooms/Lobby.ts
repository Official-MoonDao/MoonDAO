import { Room, Client } from "@colyseus/core";
import { RoomState, Player } from "../schema/State";
import { z } from "zod";
import jwt from "jsonwebtoken";

const MoveMsg = z.object({ x: z.number(), y: z.number() });

export class Lobby extends Room<RoomState> {
  maxClients = 64;
  private activeUserSessions = new Map<string, string>(); // userId -> sessionId mapping
  private sessionCleanupTimers = new Map<string, NodeJS.Timeout>(); // sessionId -> cleanup timer

  async onCreate(options: any) {
    this.setState(new RoomState());
    // Extend seat reservation TTL to avoid early expiration during WebSocket upgrade in dev
    try {
      (this as any).setSeatReservationTime?.(600); // Increased from 300 to 600 seconds
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
          `⚠️ Duplicate session detected for user ${userId}. Disconnecting old session and allowing new one`
        );

        // Force cleanup the old session and allow the new one
        this.forceCleanupUser(userId);

        // Allow the new connection
        (client as any).user = { id: userId, name: userName };
        return true;
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

    // Clear any existing cleanup timer for this session
    if (this.sessionCleanupTimers.has(client.sessionId)) {
      clearTimeout(this.sessionCleanupTimers.get(client.sessionId)!);
      this.sessionCleanupTimers.delete(client.sessionId);
    }

    // Track authenticated users to prevent duplicates
    if (user && user.id !== client.sessionId) {
      this.activeUserSessions.set(user.id, client.sessionId);
      console.log(
        `👋 User ${user.id} (${user.name}) joined with session ${client.sessionId}`
      );
    } else {
      console.log(`👋 Anonymous user joined with session ${client.sessionId}`);
    }

    const player = new Player();
    player.x = Math.random() * 400 - 200;
    player.y = Math.random() * 400 - 200;
    player.name = user?.name || `Player${Math.floor(Math.random() * 1000)}`;

    this.state.players.set(client.sessionId, player);
    console.log("onJoin", client.sessionId);
    console.log("players size", this.state.players.size);
  }

  onLeave(client: Client, consented?: boolean) {
    const user = (client as any).user;

    // Set a cleanup timer instead of immediate cleanup
    const cleanupTimer = setTimeout(() => {
      this.cleanupSession(client.sessionId, user);
      this.sessionCleanupTimers.delete(client.sessionId);
    }, 5000); // 5 second delay to allow for reconnection

    this.sessionCleanupTimers.set(client.sessionId, cleanupTimer);

    console.log(
      `🔄 Session ${client.sessionId} scheduled for cleanup in 5 seconds`
    );
  }

  private cleanupSession(sessionId: string, user: any) {
    // Remove player from game state
    this.state.players.delete(sessionId);

    // Remove from active sessions tracking (only for authenticated users, not anon)
    if (user && user.id !== sessionId) {
      // Only remove if this session is the currently active one for this user
      if (this.activeUserSessions.get(user.id) === sessionId) {
        this.activeUserSessions.delete(user.id);
        console.log(
          `🚪 User ${user.id} (${user.name}) session ${sessionId} cleaned up`
        );
      }
    } else {
      console.log(`🚪 Anonymous session ${sessionId} cleaned up`);
    }

    console.log("Session cleaned up:", sessionId);
    console.log("players size", this.state.players.size);
    console.log("active user sessions:", this.activeUserSessions.size);
  }

  // Add method to handle forced cleanup on duplicate detection
  private forceCleanupUser(userId: string) {
    const existingSessionId = this.activeUserSessions.get(userId);
    if (existingSessionId) {
      // Clear any pending cleanup timer
      if (this.sessionCleanupTimers.has(existingSessionId)) {
        clearTimeout(this.sessionCleanupTimers.get(existingSessionId)!);
        this.sessionCleanupTimers.delete(existingSessionId);
      }

      // Find and disconnect the existing client
      const existingClient = this.clients.find(
        (c) => c.sessionId === existingSessionId
      );
      if (existingClient) {
        console.log(
          `🔌 Force disconnecting existing session ${existingSessionId}`
        );
        existingClient.leave(4000, "Duplicate session detected");
      }

      // Immediate cleanup
      this.cleanupSession(existingSessionId, { id: userId });
    }
  }
}
