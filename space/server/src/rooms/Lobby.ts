import { Room, Client } from "@colyseus/core";
import { RoomState, Player, TeamRoom } from "../schema/State";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { LiveKitManager } from "../livekit-setup";

const MoveMsg = z.object({ x: z.number(), y: z.number() });
const PositionHeartbeatMsg = z.object({
  x: z.number(),
  y: z.number(),
  timestamp: z.number(),
  type: z.string().optional(),
});

const TeamRoomEntryMsg = z.object({
  teamId: z.string(),
});

const TEAM_ROOM_SIZE = 1200;
const TEAM_ROOM_SPACING = TEAM_ROOM_SIZE * 2;

// Proximity voice chat configuration
const GRID_CELL_SIZE = 1500; // Same as client-side grid size
const VOICE_PROXIMITY_RANGE = 800; // Voice range within a cell

export class Lobby extends Room<RoomState> {
  maxClients = 64;
  private activeUserSessions = new Map<string, string>(); // userId -> sessionId mapping
  private sessionCleanupTimers = new Map<string, NodeJS.Timeout>(); // sessionId -> cleanup timer
  private playerMetadata = new Map<string, any>(); // Custom metadata storage for tracking movement times
  private teamRefreshTimer: NodeJS.Timeout | null = null; // Timer for refreshing team rooms
  private teamRefreshInterval = 300000; // 5 minutes in milliseconds
  private livekit = new LiveKitManager(); // SFU for voice chat

  // Proximity voice chat tracking
  private playerVoiceRooms = new Map<string, string>(); // sessionId -> current voice room
  private voiceRoomOccupancy = new Map<string, Set<string>>(); // voice room -> set of sessionIds

  // Fetch valid teams with full data from the API
  private async fetchValidTeams(): Promise<
    { id: string; name: string; image: string }[]
  > {
    try {
      console.log("🔍 Fetching valid teams from API...");
      const apiUrl = process.env.API_BASE_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/api/teams/all-valid-team-ids`);

      if (!response.ok) {
        console.error("Failed to fetch teams:", response.statusText);
        return [];
      }

      const data = await response.json();
      const teams = data.validTeams || [];
      console.log("✅ Fetched valid teams:", teams);
      return teams;
    } catch (error) {
      console.error("Error fetching valid teams:", error);
      return [];
    }
  }

  // Helper function for backward compatibility
  private async fetchValidTeamIds(): Promise<string[]> {
    const teams = await this.fetchValidTeams();
    return teams.map((team) => team.id);
  }

  // Generate deterministic position for a team room based on team ID
  private getTeamRoomPosition(teamId: string | number): {
    x: number;
    y: number;
  } {
    // Convert to number for grid positioning
    const teamNum = parseInt(String(teamId));

    // Create a grid layout with proper spacing
    const spacing = TEAM_ROOM_SPACING; // Much more spacing (4x spacing)
    const roomsPerRow = 5; // 5 rooms per row for better organization

    const row = Math.floor(teamNum / roomsPerRow);
    const col = teamNum % roomsPerRow;

    // Center the grid around origin
    const offsetX = -((roomsPerRow - 1) * spacing) / 2;
    const offsetY = -1000; // Start grid above the spawn area

    const x = offsetX + col * spacing;
    const y = offsetY + row * spacing;

    return { x: Math.round(x), y: Math.round(y) };
  }

  // Calculate grid-based voice room for a position
  private getVoiceRoomForPosition(x: number, y: number): string {
    const gridX = Math.floor(x / GRID_CELL_SIZE);
    const gridY = Math.floor(y / GRID_CELL_SIZE);
    return `grid-${gridX}-${gridY}`;
  }

  // Get expected voice room for a player based on their current location
  private getExpectedVoiceRoom(sessionId: string): string {
    const player = this.state.players.get(sessionId);
    if (!player) {
      return "grid-0-0"; // Default room
    }

    // If player is in a team room, use team voice room
    if (player.currentTeamRoom) {
      return `team-${player.currentTeamRoom}`;
    }

    // Otherwise, use grid-based room
    return this.getVoiceRoomForPosition(player.x, player.y);
  }

  // Update player's voice room based on position
  private updatePlayerVoiceRoom(sessionId: string): void {
    const expectedRoom = this.getExpectedVoiceRoom(sessionId);
    const currentRoom = this.playerVoiceRooms.get(sessionId);

    if (currentRoom !== expectedRoom) {
      // Remove from old room
      if (currentRoom) {
        const oldRoomOccupants = this.voiceRoomOccupancy.get(currentRoom);
        if (oldRoomOccupants) {
          oldRoomOccupants.delete(sessionId);
          if (oldRoomOccupants.size === 0) {
            this.voiceRoomOccupancy.delete(currentRoom);
          }
        }
      }

      // Add to new room
      if (!this.voiceRoomOccupancy.has(expectedRoom)) {
        this.voiceRoomOccupancy.set(expectedRoom, new Set());
      }
      this.voiceRoomOccupancy.get(expectedRoom)!.add(sessionId);
      this.playerVoiceRooms.set(sessionId, expectedRoom);

      // Update player's voice room in state
      const player = this.state.players.get(sessionId);
      if (player) {
        player.currentVoiceRoom = expectedRoom;
      }

      console.log(
        `🎙️ Player ${sessionId} voice room: ${currentRoom} → ${expectedRoom}`
      );
    }
  }

  // Check if two players can hear each other (enhanced for proximity)
  private canPlayersHearEachOther(
    sessionId1: string,
    sessionId2: string
  ): boolean {
    const player1 = this.state.players.get(sessionId1);
    const player2 = this.state.players.get(sessionId2);

    if (!player1 || !player2) {
      return false;
    }

    // Team room priority - if both are in same team room, they can hear each other
    if (
      player1.currentTeamRoom &&
      player2.currentTeamRoom &&
      player1.currentTeamRoom === player2.currentTeamRoom
    ) {
      return true;
    }

    // If one is in team room and other isn't, they can't hear each other
    if (player1.currentTeamRoom || player2.currentTeamRoom) {
      return false;
    }

    // Both are in the open world - check proximity
    const distance = Math.sqrt(
      Math.pow(player1.x - player2.x, 2) + Math.pow(player1.y - player2.y, 2)
    );

    // Players can hear each other if within voice range
    return distance <= VOICE_PROXIMITY_RANGE;
  }

  // Create team rooms based on valid teams
  private async createTeamRooms() {
    const validTeams = await this.fetchValidTeams();

    console.log("🏠 Creating team rooms for teams:", validTeams);

    // Store valid team IDs in state (convert to strings for schema)
    this.state.validTeamIds.clear();
    validTeams.forEach((team) => this.state.validTeamIds.push(String(team.id)));

    // Create team rooms
    validTeams.forEach((team) => {
      const teamIdStr = String(team.id); // Convert to string
      const position = this.getTeamRoomPosition(team.id);
      const teamRoom = new TeamRoom();
      teamRoom.teamId = teamIdStr;
      teamRoom.teamName = team.name;
      teamRoom.teamImage = team.image || "";
      teamRoom.centerX = position.x;
      teamRoom.centerY = position.y;
      teamRoom.width = TEAM_ROOM_SIZE;
      teamRoom.height = TEAM_ROOM_SIZE;

      this.state.teamRooms.set(teamIdStr, teamRoom);

      console.log(
        `🏠 Created team room for "${team.name}" (ID: ${teamIdStr}) at (${position.x}, ${position.y})`
      );
    });
  }

  // Refresh team rooms by checking for new or expired teams
  private async refreshTeamRooms() {
    try {
      console.log("🔄 Refreshing team rooms...");
      const currentValidTeamIds = await this.fetchValidTeamIds();
      const previousTeamIds = Array.from(this.state.validTeamIds);

      // Find new teams that need to be added (compare as strings)
      const currentTeamIdsStr = currentValidTeamIds.map(String);
      const newTeamIds = currentValidTeamIds.filter(
        (teamId) => !previousTeamIds.includes(String(teamId))
      );

      // Find expired teams that need to be removed
      const expiredTeamIds = previousTeamIds.filter(
        (teamId) => !currentTeamIdsStr.includes(teamId)
      );

      // Add new team rooms
      newTeamIds.forEach((teamId) => {
        const teamIdStr = String(teamId); // Convert to string
        const position = this.getTeamRoomPosition(teamId);
        const teamRoom = new TeamRoom();
        teamRoom.teamId = teamIdStr; // Use string version
        teamRoom.centerX = position.x;
        teamRoom.centerY = position.y;
        teamRoom.width = TEAM_ROOM_SIZE;
        teamRoom.height = TEAM_ROOM_SIZE;

        this.state.teamRooms.set(teamIdStr, teamRoom);
        this.state.validTeamIds.push(teamIdStr);

        console.log(
          `🆕 Added new team room for team ${teamIdStr} at (${position.x}, ${position.y})`
        );
      });

      // Remove expired team rooms
      expiredTeamIds.forEach((teamId) => {
        // First, kick out any players currently in this team room
        this.clients.forEach((client) => {
          const player = this.state.players.get(client.sessionId);
          if (player && player.currentTeamRoom === teamId) {
            player.currentTeamRoom = "";
            client.send("team_room_expired", { teamId });
            console.log(
              `🚪 Kicked player ${client.sessionId} from expired team room ${teamId}`
            );
          }
        });

        // Remove the team room from state
        this.state.teamRooms.delete(teamId);
        const index = this.state.validTeamIds.indexOf(teamId);
        if (index > -1) {
          this.state.validTeamIds.splice(index, 1);
        }

        console.log(`🗑️ Removed expired team room for team ${teamId}`);
      });

      if (newTeamIds.length > 0 || expiredTeamIds.length > 0) {
        console.log(
          `🔄 Team rooms refreshed: +${newTeamIds.length} new, -${expiredTeamIds.length} expired`
        );
      } else {
        console.log("🔄 Team rooms refresh complete: no changes");
      }
    } catch (error) {
      console.error("❌ Error refreshing team rooms:", error);
    }
  }

  // Start periodic team room refresh
  private startTeamRefreshTimer() {
    if (this.teamRefreshTimer) {
      clearInterval(this.teamRefreshTimer);
    }

    this.teamRefreshTimer = setInterval(() => {
      this.refreshTeamRooms();
    }, this.teamRefreshInterval);

    console.log(
      `⏰ Started team refresh timer (interval: ${
        this.teamRefreshInterval / 1000
      }s)`
    );
  }

  // Stop periodic team room refresh
  private stopTeamRefreshTimer() {
    if (this.teamRefreshTimer) {
      clearInterval(this.teamRefreshTimer);
      this.teamRefreshTimer = null;
      console.log("⏰ Stopped team refresh timer");
    }
  }

  async onCreate(options: any) {
    this.setState(new RoomState());

    // Initialize LiveKit for voice chat
    await this.livekit.createLobbyRoom();

    // Initialize team rooms
    await this.createTeamRooms();

    // Start periodic team room refresh
    this.startTeamRefreshTimer();

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

      // Track last movement time to coordinate with heartbeat system
      const playerKey = `lastMove_${client.sessionId}`;
      this.playerMetadata.set(playerKey, Date.now());

      // Update voice room based on new position
      this.updatePlayerVoiceRoom(client.sessionId);

      // NO BOUNDS CLAMPING - let players go anywhere
    });

    // REAL-TIME position updates - no complex logic, just set position
    this.onMessage("position_heartbeat", (client, payload) => {
      const { x, y, timestamp, type } = PositionHeartbeatMsg.parse(payload);
      const p = this.state.players.get(client.sessionId);
      if (!p) return;

      // SIMPLE: Just set the position - REAL-TIME
      p.x = x;
      p.y = y;

      // Update voice room based on new position
      this.updatePlayerVoiceRoom(client.sessionId);
    });

    // Minimap position query - return authoritative server positions
    this.onMessage("minimap_positions", (client, payload) => {
      const positions: {
        [sessionId: string]: { x: number; y: number; name: string };
      } = {};

      // Collect all player positions from server state
      this.state.players.forEach((player, sessionId) => {
        positions[sessionId] = {
          x: player.x,
          y: player.y,
          name: player.name || "",
        };
      });

      // Send back authoritative positions
      client.send("minimap_positions_response", {
        positions: positions,
        timestamp: Date.now(),
      });
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

      // Check if both players are in the same voice zone (lobby or same team room)
      if (
        !this.canPlayersHearEachOther(client.sessionId, payload.targetSessionId)
      ) {
        console.log(
          `🚫 Players ${client.sessionId} and ${payload.targetSessionId} are in different voice zones`
        );
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

      // Check if both players are in the same voice zone (lobby or same team room)
      if (
        !this.canPlayersHearEachOther(client.sessionId, payload.targetSessionId)
      ) {
        console.log(
          `🚫 Players ${client.sessionId} and ${payload.targetSessionId} are in different voice zones`
        );
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

      // Check if both players are in the same voice zone (lobby or same team room)
      if (
        !this.canPlayersHearEachOther(client.sessionId, payload.targetSessionId)
      ) {
        console.log(
          `🚫 Players ${client.sessionId} and ${payload.targetSessionId} are in different voice zones`
        );
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

      // Notify other clients in the same voice zone that this client wants to join voice chat
      this.clients.forEach((otherClient) => {
        if (
          otherClient.sessionId !== client.sessionId &&
          this.canPlayersHearEachOther(client.sessionId, otherClient.sessionId)
        ) {
          otherClient.send("voice_chat_peer_joined", {
            sessionId: client.sessionId,
            position: payload.position || { x: 0, y: 0 },
          });
        }
      });

      // Send list of current voice chat participants to the new joiner (only those in same voice zone)
      const voiceChatPeers = this.clients
        .filter(
          (c) =>
            c.sessionId !== client.sessionId &&
            this.canPlayersHearEachOther(client.sessionId, c.sessionId)
        )
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

      // Notify other clients in the same voice zone that this client left voice chat
      this.clients.forEach((otherClient) => {
        if (
          otherClient.sessionId !== client.sessionId &&
          this.canPlayersHearEachOther(client.sessionId, otherClient.sessionId)
        ) {
          otherClient.send("voice_chat_peer_left", {
            sessionId: client.sessionId,
          });
        }
      });
    });

    // LiveKit Voice Chat Messages
    this.onMessage("get_livekit_token", async (client, payload) => {
      console.log(
        `🎟️ SERVER: Received get_livekit_token request from ${client.sessionId}:`,
        payload
      );
      try {
        const player = this.state.players.get(client.sessionId);
        if (!player) {
          client.send("livekit_error", { error: "Player not found" });
          return;
        }

        const roomName = payload.roomName || "lobby";
        // Create unique participant identity to prevent duplicates
        const participantName = `${player.name || "Player"}_${
          client.sessionId
        }`;
        const teamIds = Array.from(player.teamIds);

        // Ensure the LiveKit room exists for team rooms and grid rooms
        if (roomName !== "lobby" && roomName.startsWith("team-")) {
          const teamId = roomName.replace("team-", "");
          await this.livekit.createTeamRoom(teamId);
        } else if (roomName.startsWith("grid-")) {
          // For grid rooms, we need to create them dynamically
          await this.livekit.createGridRoom(roomName);
        }

        const token = await this.livekit.generateAccessToken(
          roomName,
          participantName,
          teamIds
        );

        // Use dynamic URL based on environment
        const livekitUrl =
          process.env.LIVEKIT_CLIENT_URL ||
          (process.env.NODE_ENV === "production"
            ? "wss://voice.moondao.com" // Update this to your production domain
            : "ws://localhost:7880");

        client.send("livekit_token", {
          token,
          url: livekitUrl,
          roomName,
        });

        console.log(
          `🎙️ Generated LiveKit token for ${participantName} in room ${roomName}`
        );
        console.log(
          `📤 SERVER: Sent livekit_token response to ${client.sessionId}`
        );
      } catch (error) {
        console.error("❌ Error generating LiveKit token:", error);
        client.send("livekit_error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Team room entry/exit handling
    this.onMessage("enter_team_room", (client, payload) => {
      const { teamId } = TeamRoomEntryMsg.parse(payload);
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.log(`❌ Player not found for session ${client.sessionId}`);
        return;
      }

      // Check if player has access to this team room
      if (!player.teamIds.includes(teamId)) {
        console.log(
          `🚫 Player ${client.sessionId} denied access to team room ${teamId}`
        );
        client.send("team_room_access_denied", { teamId });
        return;
      }

      // Check if team room exists
      const teamRoom = this.state.teamRooms.get(teamId);
      if (!teamRoom) {
        console.log(`❌ Team room ${teamId} not found`);
        client.send("team_room_not_found", { teamId });
        return;
      }

      // Update player's current team room
      player.currentTeamRoom = teamId;

      // Add player to team room's allowed players if not already there
      if (!teamRoom.allowedPlayers.includes(client.sessionId)) {
        teamRoom.allowedPlayers.push(client.sessionId);
      }

      // Update voice room to team room
      this.updatePlayerVoiceRoom(client.sessionId);

      console.log(`🏠 Player ${client.sessionId} entered team room ${teamId}`);

      // Notify client of successful entry
      client.send("team_room_entered", {
        teamId,
        centerX: teamRoom.centerX,
        centerY: teamRoom.centerY,
        width: teamRoom.width,
        height: teamRoom.height,
      });

      // Notify other players in the same team room
      this.clients.forEach((otherClient) => {
        const otherPlayer = this.state.players.get(otherClient.sessionId);
        if (
          otherPlayer &&
          otherPlayer.currentTeamRoom === teamId &&
          otherClient.sessionId !== client.sessionId
        ) {
          otherClient.send("player_entered_team_room", {
            sessionId: client.sessionId,
            playerName: player.name,
            teamId,
          });
        }
      });
    });

    this.onMessage("exit_team_room", (client, payload) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.log(`❌ Player not found for session ${client.sessionId}`);
        return;
      }

      const currentTeamRoom = player.currentTeamRoom;
      if (!currentTeamRoom) {
        console.log(`⚠️ Player ${client.sessionId} not in any team room`);
        return;
      }

      // Remove player from team room
      const teamRoom = this.state.teamRooms.get(currentTeamRoom);
      if (teamRoom) {
        const index = teamRoom.allowedPlayers.indexOf(client.sessionId);
        if (index > -1) {
          teamRoom.allowedPlayers.splice(index, 1);
        }
      }

      console.log(
        `🚪 Player ${client.sessionId} exited team room ${currentTeamRoom}`
      );

      // Update player's current team room
      player.currentTeamRoom = "";

      // Update voice room back to grid-based room
      this.updatePlayerVoiceRoom(client.sessionId);

      // Notify client of successful exit
      client.send("team_room_exited", { teamId: currentTeamRoom });

      // Notify other players in the team room
      this.clients.forEach((otherClient) => {
        const otherPlayer = this.state.players.get(otherClient.sessionId);
        if (
          otherPlayer &&
          otherPlayer.currentTeamRoom === currentTeamRoom &&
          otherClient.sessionId !== client.sessionId
        ) {
          otherClient.send("player_exited_team_room", {
            sessionId: client.sessionId,
            playerName: player.name,
            teamId: currentTeamRoom,
          });
        }
      });
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
        const teamIds = (payload as any)?.teamIds ?? [];
        userId = String(sub);
        userName = name;
        (client as any).userTeamIds = teamIds; // Store team IDs for later use
        console.log("✅ JWT verify successful - payload:", payload);
        console.log("🔍 STORED userTeamIds on client:", teamIds);
      } catch (e) {
        console.warn("❌ JWT verify failed:", (e as Error).message);
        console.log(
          "🔍 JWT DEBUG - Token that failed:",
          token.substring(0, 50) + "..."
        );
        // Fallback: allow connection without token (dev) – identify by sessionId
        userId = client.sessionId;
        userName = "Anon";
        (client as any).userTeamIds = []; // No teams for unauthenticated users
      }
    } else {
      // Fallback: allow connection without token (dev) – identify by sessionId
      userId = client.sessionId;
      userName = "Anon";
      (client as any).userTeamIds = []; // No teams for unauthenticated users
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

    // Generate non-overlapping spawn position
    const spawnPosition = this.findNonOverlappingSpawnPosition();
    player.x = spawnPosition.x;
    player.y = spawnPosition.y;
    player.name = user?.name || `Player${Math.floor(Math.random() * 1000)}`;

    // Set player's team IDs from JWT
    const userTeamIds = (client as any).userTeamIds || [];
    console.log(`🔍 BEFORE setting - userTeamIds from client:`, userTeamIds);
    player.teamIds.clear();
    userTeamIds.forEach((teamId: string) => player.teamIds.push(teamId));
    console.log(
      `🔍 AFTER setting - player.teamIds array:`,
      Array.from(player.teamIds)
    );

    console.log(`🔍 Player ${client.sessionId} has team IDs:`, userTeamIds);

    this.state.players.set(client.sessionId, player);

    // Initialize voice room for the player
    this.updatePlayerVoiceRoom(client.sessionId);

    console.log(
      `onJoin ${client.sessionId} spawned at (${player.x.toFixed(
        1
      )}, ${player.y.toFixed(1)})`
    );
    console.log("players size", this.state.players.size);
  }

  private findNonOverlappingSpawnPosition(): { x: number; y: number } {
    const MIN_DISTANCE = 100; // Minimum distance between players
    const MAX_ATTEMPTS = 50; // Prevent infinite loops
    const SPAWN_RADIUS = 300; // Area to spawn within

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Generate random position in spawn area
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * SPAWN_RADIUS;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      // Check if this position is far enough from all existing players
      let validPosition = true;
      for (const [sessionId, existingPlayer] of this.state.players) {
        const dx = x - existingPlayer.x;
        const dy = y - existingPlayer.y;
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

        if (distanceToPlayer < MIN_DISTANCE) {
          validPosition = false;
          break;
        }
      }

      if (validPosition) {
        console.log(
          `Found valid spawn position at (${x.toFixed(1)}, ${y.toFixed(
            1
          )}) after ${attempt + 1} attempts`
        );
        return { x, y };
      }
    }

    // Fallback: if we can't find a non-overlapping position, spawn at a random location
    // This should rarely happen unless the spawn area is very crowded
    const fallbackX = Math.random() * 600 - 300; // Larger area as fallback
    const fallbackY = Math.random() * 600 - 300;
    console.warn(
      `Could not find non-overlapping spawn position after ${MAX_ATTEMPTS} attempts, using fallback (${fallbackX.toFixed(
        1
      )}, ${fallbackY.toFixed(1)})`
    );
    return { x: fallbackX, y: fallbackY };
  }

  onLeave(client: Client, consented?: boolean) {
    const user = (client as any).user;

    // Clean up LiveKit resources if needed
    // (LiveKit handles this automatically when participants leave)

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

  onDispose() {
    console.log("Room disposed");

    // Clean up team refresh timer
    this.stopTeamRefreshTimer();
  }

  private cleanupSession(sessionId: string, user: any) {
    // Clean up voice room tracking
    const currentVoiceRoom = this.playerVoiceRooms.get(sessionId);
    if (currentVoiceRoom) {
      const roomOccupants = this.voiceRoomOccupancy.get(currentVoiceRoom);
      if (roomOccupants) {
        roomOccupants.delete(sessionId);
        if (roomOccupants.size === 0) {
          this.voiceRoomOccupancy.delete(currentVoiceRoom);
          console.log(
            `🎙️ Voice room ${currentVoiceRoom} is now empty and removed`
          );
        }
      }
      this.playerVoiceRooms.delete(sessionId);
      console.log(
        `🎙️ Removed player ${sessionId} from voice room ${currentVoiceRoom}`
      );
    }

    // Remove player from team rooms
    this.state.teamRooms.forEach((teamRoom, teamId) => {
      const index = teamRoom.allowedPlayers.indexOf(sessionId);
      if (index > -1) {
        teamRoom.allowedPlayers.splice(index, 1);
        console.log(`🚪 Removed player ${sessionId} from team room ${teamId}`);
      }
    });

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
