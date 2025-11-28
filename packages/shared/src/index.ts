// Card Types
export enum CardType {
  KING = 'KING',
  KNIGHT = 'KNIGHT',
  DRAGON = 'DRAGON',
  POTION = 'POTION',
  WAND = 'WAND',
  JESTER = 'JESTER',
  NUMBER = 'NUMBER',
}

export interface Card {
  id: string;
  type: CardType;
  value?: number; // For number cards
  name?: string;  // For specific Kings/Queens
}

export interface Queen {
  id: string;
  name: string;
  points: number;
  isAwake: boolean;
  ownerId?: string; // Player ID if awake
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  awokenQueens: Queen[];
  score: number;
  isConnected: boolean;
}

export enum GameStatus {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
}

export interface RoomInfo {
  roomId: string;
  playerCount: number;
  createdAt: number; // timestamp
}

export interface CreateRoomOptions {
  turnTimeLimit?: number; // in seconds
}

export interface GameState {
  roomId: string;
  status: GameStatus;
  hostId: string; // Added hostId
  players: Player[];
  currentTurnPlayerId: string;
  queens: Queen[];
  drawPileCount: number;
  discardPile: Card[];
  lastAction?: GameAction;
  turnDeadline?: number; // Timestamp when turn ends
  turnTimeLimit: number; // Configured time limit in seconds
  winnerId?: string | null; // Added winnerId
  pendingQueenSelection?: {
    playerId: string;
    picksRemaining?: number;
  };
}

export interface GameAction {
  type: 'PLAY_CARD' | 'DRAW_CARD' | 'DISCARD' | 'WAKE_QUEEN' | 'STEAL_QUEEN' | 'ATTACK_KNIGHT' | 'DEFEND_DRAGON' | 'SLEEP_POTION' | 'DEFEND_WAND' | 'JESTER_CHANCE';
  playerId: string;
  payload?: any;
}

// Socket Events
export enum SocketEvents {
  // Client -> Server
  CREATE_ROOM = 'create_room',
  JOIN_ROOM = 'join_room',
  GET_AVAILABLE_ROOMS = 'get_available_rooms',
  PLAY_ACTION = 'play_action',
  RESTART_GAME = 'restart_game',
  LEAVE_ROOM = 'leave_room',

  // Server -> Client
  GAME_STATE_UPDATE = 'game_state_update',
  AVAILABLE_ROOMS_UPDATE = 'available_rooms_update',
  ERROR = 'error',
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  GAME_OVER = 'game_over',

  // Debug
  DEBUG_COMMAND = 'debug_command',
  CLIENT_LOG = 'client_log',
  
  // Settings
  UPDATE_GAME_SETTINGS = 'update_game_settings'
}

export interface UpdateSettingsPayload {
    roomId: string;
    playerId: string; // To verify host
    settings: CreateRoomOptions;
}

export interface DebugCommand {
  type: 'SET_GAME_STATUS' | 'RESET_GAME' | 'GIVE_CARD' | 'SWITCH_TURN' | 'WAKE_ALL_QUEENS' | 'SLEEP_ALL_QUEENS';
  payload?: any;
}
