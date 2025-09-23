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

    // WebRTC Signaling for Voice Chat
    // Handle WebRTC offer from client
    this.onMessage("webrtc_offer", (client, payload) => {
      console.log(
        `🎤 WebRTC offer from ${client.sessionId} to ${payload.targetSessionId}`
      );

      if (!payload.targetSessionId || !payload.offer) {
        console.error("Invalid WebRTC offer payload");
        return;
      }

      const targetClient = this.clients.find(
        (c) => c.sessionId === payload.targetSessionId
      );
      if (targetClient) {
        targetClient.send("webrtc_offer", {
          offer: payload.offer,
          fromSessionId: client.sessionId,
        });
        console.log(
          `✅ Forwarded WebRTC offer from ${client.sessionId} to ${payload.targetSessionId}`
        );
      } else {
        console.log(
          `❌ Target client ${payload.targetSessionId} not found for WebRTC offer`
        );
      }
    });

    // Handle WebRTC answer from client
    this.onMessage("webrtc_answer", (client, payload) => {
      console.log(
        `🎤 WebRTC answer from ${client.sessionId} to ${payload.targetSessionId}`
      );

      if (!payload.targetSessionId || !payload.answer) {
        console.error("Invalid WebRTC answer payload");
        return;
      }

      const targetClient = this.clients.find(
        (c) => c.sessionId === payload.targetSessionId
      );
      if (targetClient) {
        targetClient.send("webrtc_answer", {
          answer: payload.answer,
          fromSessionId: client.sessionId,
        });
        console.log(
          `✅ Forwarded WebRTC answer from ${client.sessionId} to ${payload.targetSessionId}`
        );
      } else {
        console.log(
          `❌ Target client ${payload.targetSessionId} not found for WebRTC answer`
        );
      }
    });

    // Handle WebRTC ICE candidates
    this.onMessage("webrtc_ice_candidate", (client, payload) => {
      console.log(
        `🎤 WebRTC ICE candidate from ${client.sessionId} to ${payload.targetSessionId}`
      );

      if (!payload.targetSessionId || !payload.candidate) {
        console.error("Invalid WebRTC ICE candidate payload");
        return;
      }

      const targetClient = this.clients.find(
        (c) => c.sessionId === payload.targetSessionId
      );
      if (targetClient) {
        targetClient.send("webrtc_ice_candidate", {
          candidate: payload.candidate,
          fromSessionId: client.sessionId,
        });
        console.log(
          `✅ Forwarded ICE candidate from ${client.sessionId} to ${payload.targetSessionId}`
        );
      } else {
        console.log(
          `❌ Target client ${payload.targetSessionId} not found for ICE candidate`
        );
      }
    });

    // Handle voice chat room join/leave
    this.onMessage("voice_chat_join", (client, payload) => {
      console.log(`🎤 ${client.sessionId} joining voice chat`);

      // Notify all other clients that this client wants to join voice chat
      this.broadcast(
        "voice_chat_peer_joined",
        {
          sessionId: client.sessionId,
          position: payload.position || { x: 0, y: 0 },
        },
        { except: client }
      );

      // Send list of current voice chat participants to the new joiner
      const voiceChatPeers = this.clients
        .filter((c) => c.sessionId !== client.sessionId)
        .map((c) => ({
          sessionId: c.sessionId,
          position: this.state.players.get(c.sessionId)
            ? {
                x: this.state.players.get(c.sessionId)!.x,
                y: this.state.players.get(c.sessionId)!.y,
              }
            : { x: 0, y: 0 },
        }));

      client.send("voice_chat_peers_list", { peers: voiceChatPeers });
    });

    this.onMessage("voice_chat_leave", (client, payload) => {
      console.log(`🎤 ${client.sessionId} leaving voice chat`);

      // Notify all other clients that this client left voice chat
      this.broadcast(
        "voice_chat_peer_left",
        {
          sessionId: client.sessionId,
        },
        { except: client }
      );
    });
  }

  async onAuth(client: Client, options: any, request: any) {
    // Accept JWT passed via query (?token=...) or options, but do not require it in dev
    const urlToken = new URL(request.url!, "http://x").searchParams.get(
      "token"
    );
    console.log(
      "🔍 AUTH DEBUG - URL token from query:",
      urlToken ? urlToken.substring(0, 20) + "..." : "none"
    );

    const optToken = options?.token;
    console.log(
      "🔍 AUTH DEBUG - Options token:",
      optToken ? optToken.substring(0, 20) + "..." : "none"
    );

    const token = optToken || urlToken;
    console.log(
      "🔍 AUTH DEBUG - Final token to use:",
      token ? token.substring(0, 20) + "..." : "none"
    );
    let userId = "";
    let userName = "Anon";

    if (token) {
      try {
        console.log(
          "🔍 JWT DEBUG - Token found:",
          token.substring(0, 20) + "..."
        );
        console.log(
          "🔍 JWT DEBUG - JWT_SECRET exists:",
          !!process.env.JWT_SECRET
        );

        const payload = jwt.verify(token, process.env.JWT_SECRET!);
        const sub = (payload as any)?.sub ?? "";
        const name =
          (payload as any)?.name ?? (payload as any)?.wallet ?? "Anon";
        userId = String(sub);
        userName = name;
        console.log("✅ JWT verify successful - payload:", payload);
      } catch (e) {
        console.warn("❌ JWT verify failed:", (e as Error).message);
        console.log(
          "🔍 JWT DEBUG - Token that failed:",
          token.substring(0, 50) + "..."
        );
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
