import { Game } from './game/Game';
import { v4 as uuidv4 } from 'uuid';
import { GameStatus, RoomInfo, GameState, CreateRoomOptions } from '@sq/shared';

export class RoomManager {
  private games: Map<string, Game> = new Map();

  constructor() {
    // Cleanup stale games every minute
    setInterval(() => this.cleanupStaleGames(), 60 * 1000);
  }

  private cleanupStaleGames() {
    const now = Date.now();
    // 2 hours timeout for stale games
    const TIMEOUT = 2 * 60 * 60 * 1000; 
    
    for (const [roomId, game] of this.games.entries()) {
        // If game is old and has no connected players, remove it
        if (now - game.createdAt > TIMEOUT && game.players.every(p => !p.isConnected)) {
            this.games.delete(roomId);
        }
    }
  }

  public createRoom(onStateChange?: (state: GameState) => void, options?: CreateRoomOptions): string {
    const roomId = uuidv4().substring(0, 8);
    const game = new Game(roomId, onStateChange, options);
    this.games.set(roomId, game);
    return roomId;
  }

  public getGame(roomId: string): Game | undefined {
    return this.games.get(roomId);
  }

  public getAvailableRooms(): RoomInfo[] {
    const rooms: RoomInfo[] = [];
    this.games.forEach((game) => {
      if (game.status === GameStatus.LOBBY) {
        rooms.push({
          roomId: game.id,
          playerCount: game.players.length,
          createdAt: game.createdAt
        });
      }
    });
    return rooms.sort((a, b) => b.createdAt - a.createdAt);
  }

  public joinRoom(roomId: string, userId: string, playerName: string, socketId: string): Game {
    const game = this.games.get(roomId);
    if (!game) {
      throw new Error('Room not found');
    }

    // Check if player already in game (reconnect)
    const existingPlayer = game.players.find(p => p.id === userId);
    if (existingPlayer) {
      game.playerReconnected(userId, socketId);
      return game;
    }

    game.addPlayer(userId, playerName, socketId);
    return game;
  }

  public leaveRoom(roomId: string, socketId: string): Game | null {
    const game = this.games.get(roomId);
    if (game) {
      // Explicit leave removes the player
      game.removePlayer(game.players.find(p => p.socketId === socketId)?.id || '');
      
      if (game.players.length === 0) {
        this.games.delete(roomId);
        return null;
      }
      return game;
    }
    return null;
  }

  public handleDisconnect(socketId: string): { roomId: string, game: Game | null } | undefined {
    for (const [roomId, game] of this.games.entries()) {
      const player = game.players.find(p => p.socketId === socketId);
      if (player) {
         // Disconnect only marks as disconnected, does not remove
         game.disconnectPlayer(socketId);
         return { roomId, game };
      }
    }
    return undefined;
  }
}

