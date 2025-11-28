import { useEffect, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { GameState, SocketEvents, GameAction, DebugCommand, CreateRoomOptions, UpdateSettingsPayload } from '@sq/shared';
import { logger } from '../utils/logger';

const SOCKET_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? undefined : `http://${window.location.hostname}:3000`);

export function useGameSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Generate User ID
    let uid = localStorage.getItem('sq_user_id');
    if (!uid) {
        uid = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('sq_user_id', uid);
    }
    
    const newSocket = io(SOCKET_URL, {
        auth: { userId: uid },
        transports: ['websocket'], // Force websocket to avoid long-polling issues
        reconnection: true,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      logger.setSocket(newSocket);
      logger.info('Socket connected');
    });
    newSocket.on('disconnect', () => setIsConnected(false));
    
    newSocket.on(SocketEvents.GAME_STATE_UPDATE, (state: GameState) => {
      setGameState(state);
      setError(null);
    });

    newSocket.on(SocketEvents.ERROR, (msg: string) => {
      logger.error('Socket error received', { msg });
      setError(msg);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const getUserId = useCallback(() => localStorage.getItem('sq_user_id') || '', []);

  const createRoom = useCallback((playerName: string, options?: CreateRoomOptions) => {
    return new Promise<string>((resolve) => {
        socket?.emit(SocketEvents.CREATE_ROOM, { playerName, userId: getUserId(), options }, (roomId: string) => {
            resolve(roomId);
        });
    });
  }, [socket, getUserId]);

  const joinRoom = useCallback((roomId: string, playerName: string) => {
    socket?.emit(SocketEvents.JOIN_ROOM, { roomId, playerName, userId: getUserId() });
  }, [socket, getUserId]);

  const leaveRoom = useCallback((roomId: string) => {
    socket?.emit(SocketEvents.LEAVE_ROOM, { roomId });
    setGameState(null);
  }, [socket]);


  const startGame = useCallback((roomId: string) => {
      logger.info('Starting game for room:', { roomId });
      socket?.emit('start_game', roomId);
  }, [socket]);

  const playAction = useCallback((roomId: string, action: GameAction) => {
    socket?.emit(SocketEvents.PLAY_ACTION, { roomId, action });
  }, [socket]);

  const sendDebugCommand = useCallback((roomId: string, command: DebugCommand) => {
      socket?.emit(SocketEvents.DEBUG_COMMAND, { roomId, command });
  }, [socket]);

  const updateGameSettings = useCallback((roomId: string, settings: CreateRoomOptions) => {
      socket?.emit(SocketEvents.UPDATE_GAME_SETTINGS, { roomId, playerId: getUserId(), settings } as UpdateSettingsPayload);
  }, [socket, getUserId]);

  const clearError = useCallback(() => setError(null), []);

  return {
    socket,
    gameState,
    isConnected,
    error,
    clearError,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    playAction,
    sendDebugCommand,
    updateGameSettings
  };
}

