# MoonDAO Space

A real-time multiplayer virtual space experience built with Godot and Colyseus. Explore the lunar surface with other MoonDAO members in this immersive 3D environment.

## 🎮 Game Client

The game is built with **Godot 4** and features:

- **3D Lunar Environment**: Explore a detailed lunar surface with pixelated terrain
- **Real-time Multiplayer**: Connect with up to 64 other players simultaneously  
- **Voice Communication**: Built-in voice chat to communicate with other astronauts
- **Authentic Astronaut Experience**: Play as an astronaut exploring the Moon

### Getting Started

1. **Install Godot 4.0+** from [godotengine.org](https://godotengine.org/)

2. **Open the project:**
   - Launch Godot
   - Click "Import" and select the `game/project.godot` file

3. **Run the game:**
   - Press F5 or click the Play button in Godot
   - The game will connect to the multiplayer server automatically

### Citizen Verification

MoonDAO Space uses **JWT-based citizen verification** to authenticate players:

- **Verified Citizens**: Players with valid MoonDAO citizenship NFTs receive JWT tokens for authenticated access
- **Anonymous Access**: Development/testing mode allows connection without verification
- **Secure Authentication**: JWT tokens contain user identity, wallet address, and citizenship status
- **Integration**: Authentication is handled through the MoonDAO UI when accessing the space client

When exported to the web interface, the game automatically receives JWT tokens from authenticated MoonDAO citizens.

### Exporting for Web

To export the game as an HTML5 build for the MoonDAO web interface:

1. **Setup Web Export Template:**
   - In Godot, go to `Project → Export...`
   - Click "Add..." and select "Web"
   - Download the export templates if prompted

2. **Configure Export Settings:**
   - Set the export path to: `../ui/public/space-client/index.html`

3. **Export the Game:**
   - Click "Export All"
   - Click "Release"
   - The game will be built and placed in `/ui/public/space-client/`
   - The web build can then be accessed through the MoonDAO UI at /space

### Game Controls

- **Arrow Buttons** - Move your astronaut
- **Mic Button** - Enable/Disable the microphone

## 🚀 Server

The multiplayer backend is powered by a Node.js server using Colyseus for real-time synchronization and **JWT-based citizen verification**.

### Key Features:
- **Citizen Authentication**: JWT tokens verify MoonDAO citizenship NFT ownership
- **Real-time Multiplayer**: Up to 64 concurrent players per room
- **Voice Communication**: Secure voice data broadcasting between verified citizens
- **Fallback Access**: Anonymous mode for development and testing

**For detailed server documentation, setup instructions, and API reference, see:**  
📖 **[Server README](./server/README.md)**

## 🏗️ Project Structure

```
space/
├── game/                    # Godot 4 game client
│   ├── scenes/             # Game scenes and levels
│   ├── scripts/            # Game logic and networking
│   ├── art/               # Textures and visual assets
│   └── addons/            # Godot plugins (Colyseus 
├── server/                 # Node.js multiplayer 
│   ├── src/               # Server source code
│   └── README.md          # Detailed server 
└── README.md              # This file
```

## 🔗 Links

- [MoonDAO Website](https://moondao.com)
- [Server Documentation](./server/README.md)
- [Godot Engine](https://godotengine.org/)
- [Colyseus Multiplayer Framework](https://colyseus.io/)

## 📝 License

MIT - See the main MoonDAO project for license details.
