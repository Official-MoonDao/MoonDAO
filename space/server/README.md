# MoonDAO Space Server

A real-time multiplayer space server built with [Colyseus](https://colyseus.io/) for the MoonDAO virtual space experience. This server handles player movement, voice communication, and room management for a shared virtual environment.

## 🚀 Features

- **Real-time multiplayer**: Support for up to 64 concurrent players per room
- **Player movement**: Synchronized player position updates across all clients
- **Voice communication**: Real-time voice data broadcasting between players
- **JWT Authentication**: Secure user authentication with fallback to anonymous users
- **Custom WebSocket handling**: Enhanced debugging and seat reservation management
- **Schema-based state**: Type-safe state synchronization using Colyseus schemas

## 📋 Requirements

- Node.js 16+ 
- TypeScript 5.9+
- Yarn or npm

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   yarn install
   # or
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Required for production
   export JWT_SECRET=your_jwt_secret_here
   export PORT=2567  # Optional, defaults to 2567
   ```

## 🎮 Usage

### Development

Start the development server with hot reloading:

```bash
yarn dev
# or
npm run dev
```

This runs the server on `ws://localhost:2567` with a development JWT secret.

### Production

1. **Build the project:**
   ```bash
   yarn build
   # or
   npm run build
   ```

2. **Start the server:**
   ```bash
   yarn start
   # or
   npm start
   ```

### Testing Connection

Test the server connection using the included test script:

```bash
yarn seat:test
# or
npm run seat:test
```

You can customize the test with environment variables:
```bash
COLYSEUS_ENDPOINT=ws://your-server:2567 COLYSEUS_ROOM=lobby yarn seat:test
```

## 🏗️ Architecture

### Core Components

- **`src/index.ts`** - Main server entry point with custom WebSocket transport
- **`src/rooms/Lobby.ts`** - Primary room class handling player interactions
- **`src/schema/State.ts`** - Colyseus schema definitions for synchronized state

### Room System

The server uses a single "lobby" room type that supports:

- **Player Management**: Join/leave events with user authentication
- **Movement System**: Real-time position synchronization
- **Voice Broadcasting**: Peer-to-peer voice data relay
- **Seat Reservation**: Enhanced seat management with extended TTL

### Authentication

The server supports flexible authentication:

1. **JWT Token**: Pass via query parameter `?token=your_jwt_token` or in room options
2. **Anonymous Access**: Automatic fallback for development/testing

JWT payload should include:
```json
{
  "sub": "user_id",
  "name": "Display Name",
  "wallet": "wallet_address"  // fallback for name
}
```

## 📡 Client Communication

### Connecting to a Room

```javascript
import { Client } from "colyseus.js";

const client = new Client("ws://localhost:2567");
const room = await client.joinOrCreate("lobby", {
  token: "your_jwt_token"  // optional
});
```

### Message Types

#### Player Movement
Send movement delta:
```javascript
room.send("move", { x: deltaX, y: deltaY });
```

#### Voice Data
Send voice data for broadcasting:
```javascript
room.send("voice_data", {
  data: audioBytes,        // raw audio bytes
  sample_rate: 22050,      // audio sample rate
  format: "bytes"          // data format
});

// Or with frames format:
room.send("voice_data", {
  frames: audioFrames,     // audio frame data
  sample_rate: 22050,
  format: "frames"
});
```

### State Synchronization

The room state is automatically synchronized via Colyseus schemas:

```javascript
room.state.players.onAdd = (player, sessionId) => {
  console.log(`Player ${player.name} joined at (${player.x}, ${player.y})`);
};

room.state.players.onChange = (player, sessionId) => {
  console.log(`Player ${player.name} moved to (${player.x}, ${player.y})`);
};
```

### Receiving Voice Data

```javascript
room.onMessage("voice_data", (payload) => {
  const { session_id, data, frames, sample_rate, format } = payload;
  // Handle audio data from other players
});
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `2567` |
| `JWT_SECRET` | Secret for JWT verification | Required in production |
| `COLYSEUS_SEAT_RESERVATION_TIME` | Seat reservation timeout | `300` seconds |

### Room Settings

- **Max Clients**: 64 players per room
- **Seat Reservation TTL**: 300 seconds (5 minutes)
- **Heartbeat**: Automatic ping/pong handling

## 🐛 Debugging

The server includes extensive debug logging:

- WebSocket connection details
- Player movement tracking (for significant movements)
- Voice data transmission logs
- Seat reservation status
- Authentication events

Logs are output to console with structured information for easy debugging.

## 📁 Project Structure

```
space/server/
├── src/
│   ├── index.ts          # Main server entry point
│   ├── rooms/
│   │   └── Lobby.ts      # Lobby room implementation
│   └── schema/
│       └── State.ts      # Colyseus state schemas
├── scripts/
│   └── seat-test.mjs     # Connection test script
├── dist/                 # Compiled JavaScript output
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## 🔗 Integration

This server is designed to work with the MoonDAO space client located in `../../ui/pages/space/`. The client handles:

- 3D rendering and player avatars
- Voice capture and playback
- User interface and controls
- Authentication token management

## 🚦 Error Handling

The server includes robust error handling for:

- Invalid JWT tokens (falls back to anonymous)
- WebSocket connection issues
- Malformed message payloads
- Seat reservation expiration
- Voice data processing errors

## 📈 Performance Considerations

- **Voice Data**: Large audio payloads are broadcast efficiently using Colyseus's optimized messaging
- **Movement**: Only significant movements are logged to reduce noise
- **State Sync**: Uses Colyseus schemas for efficient binary state synchronization
- **Memory**: Automatic cleanup when players disconnect

## 🔒 Security

- JWT token validation with graceful fallback
- Input validation using Zod schemas
- Seat reservation system prevents unauthorized connections
- Error boundary handling to prevent server crashes

## 📝 License

MIT - See the main MoonDAO project for license details.
