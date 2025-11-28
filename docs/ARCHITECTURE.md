# Sleeping Queens Online - Architecture Documentation

## Overview
This project is a multiplayer online implementation of the Sleeping Queens card game. It uses a client-server architecture with real-time communication via WebSockets.

## Tech Stack
- **Monorepo Management**: npm workspaces
- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Frontend**: React, Vite, TypeScript, CSS Modules
- **Shared**: Shared TypeScript definitions for types and constants

## Directory Structure
```
/
├── packages/
│   ├── client/      # React Frontend
│   ├── server/      # Node.js Backend
│   └── shared/      # Shared Types
├── docs/            # Documentation
└── package.json     # Root configuration
```

## Architecture Components

### Server (`packages/server`)
- **Entry Point**: `src/index.ts` - Sets up Express and Socket.io server. Handles socket connection/disconnection and routing events to `RoomManager`.
- **RoomManager**: `src/RoomManager.ts` - Manages multiple `Game` instances using UUIDs for room IDs. Handles player joining/reconnecting.
- **Game Logic**:
  - `src/game/Game.ts`: The core state machine. Handles turn management, action validation, and win conditions.
  - `src/game/Deck.ts`: Manages the deck of cards (shuffle, draw, recycle).
  - `src/game/Player.ts`: Manages player state (hand, awoken queens, score).

### Client (`packages/client`)
- **State Management**: `src/hooks/useGameSocket.ts` - Custom hook that wraps `socket.io-client`. It manages the connection, handles incoming state updates, and exposes methods for UI components to emit actions. It also handles user identity persistence via `localStorage`.
- **UI Components**:
  - `GameRoom.tsx`: Main game interface. Renders the game state.
  - `Lobby.tsx`: Entry screen for creating/joining games.
  - `Card.tsx`: Renders individual cards.
  - `Game.css`: Styling for the game.

### Shared (`packages/shared`)
- Defines the contract between Client and Server.
- `CardType`, `GameState`, `SocketEvents` enums/interfaces ensure type safety across the network boundary.

## Key Features & Robustness

### State Management
- **Authoritative Server**: The server is the single source of truth. The client is a "dumb" view that renders the state received from the server.
- **Event-Driven Updates**: State changes are broadcast to all clients in a room immediately after an action is processed.

### Networking & Fault Tolerance
- **Reconnection**: Players are identified by a persistent `userId` stored in `localStorage`, not just the transient `socket.id`. If a player disconnects and reconnects, they rejoin their session seamlessly.
- **Validation**: All actions are validated on the server (turn check, card ownership check, rule check) to prevent cheating or inconsistent states.
- **Deck Recycling**: When the draw pile is empty, the discard pile is automatically reshuffled and recycled.

### Scalability
- The `RoomManager` design allows for multiple concurrent game sessions.
- State is currently in-memory for speed and simplicity (MVP), but the `Game` class structure is ready for persistence (e.g., Redis/Postgres) if needed for scaling across multiple server instances.

## Running the Project
1. Install dependencies: `npm install`
2. Start development: `npm start` (runs both client and server)
   - Server: http://localhost:3000
   - Client: http://localhost:5173

