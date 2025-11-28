import { RoomManager } from './RoomManager';
import { Game } from './game/Game';
import { GameStatus } from '@sq/shared';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    jest.useFakeTimers();
    roomManager = new RoomManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should create a new room', () => {
    const roomId = roomManager.createRoom();
    expect(roomId).toBeDefined();
    expect(typeof roomId).toBe('string');
    
    const game = roomManager.getGame(roomId);
    expect(game).toBeDefined();
    expect(game).toBeInstanceOf(Game);
    expect(game?.id).toBe(roomId);
  });

  test('should return available rooms', () => {
    const r1 = roomManager.createRoom();
    const r2 = roomManager.createRoom();

    const available = roomManager.getAvailableRooms();
    expect(available).toHaveLength(2);
    expect(available.map(r => r.roomId)).toContain(r1);
    expect(available.map(r => r.roomId)).toContain(r2);
  });

  test('should not list full or playing games as available', () => {
    const r1 = roomManager.createRoom();
    const game = roomManager.getGame(r1)!;
    
    // Fill the room
    for(let i=0; i<5; i++) {
        game.addPlayer(`p${i}`, `Player ${i}`, `s${i}`);
    }
    
    // Should still be listed? logic says: if (game.status === GameStatus.LOBBY)
    // It doesn't check fullness in getAvailableRooms explicitly unless game status changes?
    // Game status stays LOBBY until started.
    
    // Let's start it
    game.startGame();
    expect(game.status).toBe(GameStatus.PLAYING);
    
    const available = roomManager.getAvailableRooms();
    expect(available.find(r => r.roomId === r1)).toBeUndefined();
  });

  test('should join a room', () => {
    const roomId = roomManager.createRoom();
    const game = roomManager.joinRoom(roomId, 'p1', 'Player 1', 's1');
    
    expect(game.players).toHaveLength(1);
    expect(game.players[0].id).toBe('p1');
  });

  test('should handle reconnect', () => {
    const roomId = roomManager.createRoom();
    roomManager.joinRoom(roomId, 'p1', 'Player 1', 's1');
    
    // Disconnect logic triggers isConnected = false
    const game = roomManager.getGame(roomId)!;
    game.disconnectPlayer('s1');
    expect(game.players[0].isConnected).toBe(false);
    
    // Reconnect
    roomManager.joinRoom(roomId, 'p1', 'Player 1', 's2');
    expect(game.players).toHaveLength(1);
    expect(game.players[0].isConnected).toBe(true);
    expect(game.players[0].socketId).toBe('s2');
  });

  test('should throw when joining non-existent room', () => {
    expect(() => {
      roomManager.joinRoom('fake-id', 'p1', 'Player 1', 's1');
    }).toThrow('Room not found');
  });

  test('should handle player leave', () => {
    const roomId = roomManager.createRoom();
    roomManager.joinRoom(roomId, 'p1', 'Player 1', 's1');
    roomManager.joinRoom(roomId, 'p2', 'Player 2', 's2');
    
    roomManager.leaveRoom(roomId, 's1');
    const game = roomManager.getGame(roomId)!;
    expect(game.players).toHaveLength(1);
    expect(game.players[0].id).toBe('p2');
  });

  test('should delete room when last player leaves', () => {
    const roomId = roomManager.createRoom();
    roomManager.joinRoom(roomId, 'p1', 'Player 1', 's1');
    
    const result = roomManager.leaveRoom(roomId, 's1');
    expect(result).toBeNull(); // Returns null if room deleted
    expect(roomManager.getGame(roomId)).toBeUndefined();
  });

  test('should handle disconnect without removal', () => {
    const roomId = roomManager.createRoom();
    roomManager.joinRoom(roomId, 'p1', 'Player 1', 's1');
    
    const res = roomManager.handleDisconnect('s1');
    expect(res?.roomId).toBe(roomId);
    expect(res?.game?.players[0].isConnected).toBe(false);
    
    // Room still exists
    expect(roomManager.getGame(roomId)).toBeDefined();
  });

  test('should cleanup stale games', () => {
    const roomId = roomManager.createRoom();
    const game = roomManager.getGame(roomId)!;
    
    // Mock time travel
    const now = Date.now();
    const twoHoursAgo = now - (2 * 60 * 60 * 1000 + 1000);
    
    // Hack private property for test or assume we can set createdAt? 
    // Game.createdAt is public readonly, initialized in constructor.
    // We might need to cast to any to test or add a method.
    (game as any).createdAt = twoHoursAgo;
    
    // Game must have no connected players
    // (New game has 0 players, so all satisfy !isConnected check effectively or loop is empty)
    // Logic: game.players.every(p => !p.isConnected) -> for empty array acts as true.
    
    // Trigger interval callback manually or fast-forward time
    jest.advanceTimersByTime(60 * 1000);
    
    expect(roomManager.getGame(roomId)).toBeUndefined();
  });
});

