import { RoomServiceClient, AccessToken, Room } from "livekit-server-sdk";

export class LiveKitManager {
  private client: RoomServiceClient;
  private apiKey: string;
  private apiSecret: string;
  private wsUrl: string;

  constructor() {
    // Use environment variables or defaults for development
    this.apiKey = process.env.LIVEKIT_API_KEY || "devkey";
    this.apiSecret = process.env.LIVEKIT_API_SECRET || "secret";
    this.wsUrl = process.env.LIVEKIT_WS_URL || "ws://livekit:7880";

    this.client = new RoomServiceClient(
      this.wsUrl,
      this.apiKey,
      this.apiSecret
    );

    console.log("🎙️ LiveKit Manager initialized");
    console.log("🔗 WebSocket URL:", this.wsUrl);
  }

  /**
   * Create or get a LiveKit room for team voice chat
   */
  async createTeamRoom(teamId: string): Promise<Room> {
    const roomName = `team-${teamId}`;

    try {
      // Try to get existing room first
      const existingRooms = await this.client.listRooms();
      const existingRoom = existingRooms.find((room) => room.name === roomName);

      if (existingRoom) {
        console.log(`🏠 Using existing LiveKit room: ${roomName}`);
        return existingRoom;
      }

      // Create new room
      const room = await this.client.createRoom({
        name: roomName,
        emptyTimeout: 300, // 5 minutes
        maxParticipants: 50, // Reasonable limit per team
      });

      console.log(`🏠 Created LiveKit room: ${roomName}`);
      return room;
    } catch (error) {
      console.error(`❌ Failed to create LiveKit room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Create lobby room for general voice chat
   */
  async createLobbyRoom(): Promise<Room> {
    const roomName = "lobby";

    try {
      const existingRooms = await this.client.listRooms();
      const existingRoom = existingRooms.find((room) => room.name === roomName);

      if (existingRoom) {
        console.log(`🏠 Using existing LiveKit lobby room`);
        return existingRoom;
      }

      const room = await this.client.createRoom({
        name: roomName,
        emptyTimeout: 60, // 1 minute for lobby
        maxParticipants: 100, // More for lobby
      });

      console.log(`🏠 Created LiveKit lobby room`);
      return room;
    } catch (error) {
      console.error(`❌ Failed to create LiveKit lobby room:`, error);
      throw error;
    }
  }

  /**
   * Create a grid room for proximity voice chat
   */
  async createGridRoom(roomName: string): Promise<Room> {
    try {
      // Try to get existing room first
      const existingRooms = await this.client.listRooms();
      const existingRoom = existingRooms.find((room) => room.name === roomName);

      if (existingRoom) {
        console.log(`🌐 Using existing LiveKit grid room: ${roomName}`);
        return existingRoom;
      }

      // Create new grid room
      const room = await this.client.createRoom({
        name: roomName,
        emptyTimeout: 300, // 5 minutes for grid rooms
        maxParticipants: 50, // Reasonable limit per grid cell
      });

      console.log(`🌐 Created LiveKit grid room: ${roomName}`);
      return room;
    } catch (error) {
      console.error(
        `❌ Failed to create LiveKit grid room ${roomName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Generate access token for a player to join a room
   */
  async generateAccessToken(
    roomName: string,
    participantName: string,
    teamIds?: string[]
  ): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantName,
      name: participantName,
    });

    // Add room access
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    // Add metadata with team info for spatial audio
    const metadata = {
      teamIds: teamIds || [],
      joinTime: Date.now(),
    };

    token.metadata = JSON.stringify(metadata);

    return await token.toJwt();
  }

  /**
   * Get all participants in a room
   */
  async getRoomParticipants(roomName: string) {
    try {
      const participants = await this.client.listParticipants(roomName);
      return participants;
    } catch (error) {
      console.error(
        `❌ Failed to get participants for room ${roomName}:`,
        error
      );
      return [];
    }
  }

  /**
   * Remove a participant from a room
   */
  async removeParticipant(roomName: string, identity: string) {
    try {
      await this.client.removeParticipant(roomName, identity);
      console.log(`👋 Removed participant ${identity} from room ${roomName}`);
    } catch (error) {
      console.error(
        `❌ Failed to remove participant ${identity} from room ${roomName}:`,
        error
      );
    }
  }

  /**
   * Clean up empty rooms
   */
  async cleanupEmptyRooms() {
    try {
      const rooms = await this.client.listRooms();

      for (const room of rooms) {
        if (room.numParticipants === 0) {
          await this.client.deleteRoom(room.name);
          console.log(`🧹 Cleaned up empty LiveKit room: ${room.name}`);
        }
      }
    } catch (error) {
      console.error("❌ Failed to cleanup empty rooms:", error);
    }
  }
}
