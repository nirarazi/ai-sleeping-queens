import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { RoomManager } from './RoomManager';
import { SocketEvents, UpdateSettingsPayload } from '@sq/shared';
import logger from './utils/logger';

const app = express();
app.use(cors());

// Serve static files from the client build directory
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const roomManager = new RoomManager();

const broadcastRoomList = () => {
  io.emit(SocketEvents.AVAILABLE_ROOMS_UPDATE, roomManager.getAvailableRooms());
};

io.on('connection', (socket) => {
  logger.info('User connected:', { socketId: socket.id });

  socket.on(SocketEvents.GET_AVAILABLE_ROOMS, () => {
    socket.emit(SocketEvents.AVAILABLE_ROOMS_UPDATE, roomManager.getAvailableRooms());
  });

  socket.on(SocketEvents.CREATE_ROOM, ({ playerName, userId }, callback) => {
    const roomId = roomManager.createRoom();
    try {
      const game = roomManager.joinRoom(roomId, userId, playerName, socket.id);
      socket.join(roomId);
      callback(roomId);
      io.to(roomId).emit(SocketEvents.GAME_STATE_UPDATE, game.getState());
      broadcastRoomList();
    } catch (e: any) {
      logger.error('Error creating room:', { error: e.message, stack: e.stack });
      socket.emit(SocketEvents.ERROR, e.message);
    }
  });

  socket.on(SocketEvents.JOIN_ROOM, ({ roomId, playerName, userId }) => {
    try {
      const game = roomManager.joinRoom(roomId, userId, playerName, socket.id);
      socket.join(roomId);
      io.to(roomId).emit(SocketEvents.GAME_STATE_UPDATE, game.getState());
      broadcastRoomList();
    } catch (e: any) {
      logger.error('Error joining room:', { error: e.message, stack: e.stack });
      socket.emit(SocketEvents.ERROR, e.message);
    }
  });

  socket.on(SocketEvents.LEAVE_ROOM, ({ roomId }) => {
      const game = roomManager.leaveRoom(roomId, socket.id);
      socket.leave(roomId);
      
      if (game) {
          io.to(roomId).emit(SocketEvents.GAME_STATE_UPDATE, game.getState());
      }
      broadcastRoomList();
  });

  socket.on(SocketEvents.PLAY_ACTION, ({ roomId, action }) => {
    logger.info("Received play_action", { roomId, action });
    const game = roomManager.getGame(roomId);
    if (!game) {
        logger.error("Game not found for action", { roomId });
        return;
    }

    try {
      const player = game.players.find(p => p.socketId === socket.id);
      if (!player) {
          logger.error(`Player not found for socket ${socket.id} in room ${roomId}`);
          throw new Error('Player not identified');
      }
      
      action.playerId = player.id;
      
      logger.info(`Processing action ${action.type} for player ${player.name} (${player.id})`);
      game.handleAction(action);
      io.to(roomId).emit(SocketEvents.GAME_STATE_UPDATE, game.getState());
    } catch (e: any) {
      logger.error("Action error:", { error: e.message, stack: e.stack });
      socket.emit(SocketEvents.ERROR, e.message);
    }
  });
  
  socket.on('start_game', (roomId) => {
      logger.info('Received start_game request for room:', { roomId });
      const game = roomManager.getGame(roomId);
      if (game) {
          try {
             game.startGame();
             logger.info('Game started, emitting update');
             io.to(roomId).emit(SocketEvents.GAME_STATE_UPDATE, game.getState());
             broadcastRoomList();
          } catch (e: any) {
             logger.error('Error starting game:', { error: e.message, stack: e.stack });
             socket.emit(SocketEvents.ERROR, e.message);
          }
      } else {
          logger.error('Game not found for room:', { roomId });
      }
  });

  socket.on(SocketEvents.UPDATE_GAME_SETTINGS, (payload: any) => {
      const roomId = payload?.roomId;
      const playerId = payload?.playerId;
      const settings = payload?.settings;
      
      logger.info('Received UPDATE_GAME_SETTINGS', { roomId, playerId, settings });
      
      if (!roomId || !settings) {
          logger.error('Invalid settings payload', payload);
          return;
      }

      const game = roomManager.getGame(roomId);
      if (game) {
          try {
            game.updateSettings(settings, playerId);
            logger.info('Settings updated, broadcasting state');
            io.to(roomId).emit(SocketEvents.GAME_STATE_UPDATE, game.getState());
          } catch (e: any) {
              logger.error('Error updating settings', { error: e.message });
              socket.emit(SocketEvents.ERROR, e.message);
          }
      } else {
          logger.error('Game not found for settings update', { roomId });
      }
  });

  socket.on(SocketEvents.DEBUG_COMMAND, ({ roomId, command }) => {
      logger.info("Received debug command", { roomId, command });
      const game = roomManager.getGame(roomId);
      if (game) {
          game.handleDebugCommand(command);
          io.to(roomId).emit(SocketEvents.GAME_STATE_UPDATE, game.getState());
      }
  });

  // Handle Client Logs
  socket.on(SocketEvents.CLIENT_LOG, (logData: any) => {
    const { level, message, ...meta } = logData;
    logger.log(level || 'info', `[CLIENT] ${message}`, { ...meta, socketId: socket.id });
  });

  socket.on('disconnect', () => {
    logger.info('User disconnected:', { socketId: socket.id });
    const result = roomManager.handleDisconnect(socket.id);
    if (result) {
        const { roomId, game } = result;
        if (game) {
            io.to(roomId).emit(SocketEvents.GAME_STATE_UPDATE, game.getState());
        }
        broadcastRoomList();
    }
  });
});

// Handle SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/socket.io/')) return;
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  logger.info(`Production server running on port ${PORT}`);
});
