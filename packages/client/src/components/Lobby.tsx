import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { SocketEvents, RoomInfo, CreateRoomOptions } from '@sq/shared';
import { useTranslation } from 'react-i18next';

interface LobbyProps {
  onCreate: (name: string, options: CreateRoomOptions) => void;
  onJoin: (roomId: string, name: string) => void;
  socket: Socket | null;
}

export const Lobby: React.FC<LobbyProps> = ({ onCreate, onJoin, socket }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(localStorage.getItem('sq_player_name') || '');
  const [isEditingName, setIsEditingName] = useState(!localStorage.getItem('sq_player_name'));
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [availableRooms, setAvailableRooms] = useState<RoomInfo[]>([]);
  const [, setTick] = useState(0); // Force update for time ago

  useEffect(() => {
    if (name) {
        localStorage.setItem('sq_player_name', name);
    }
  }, [name]);

  useEffect(() => {
    if (!socket) return;

    socket.on(SocketEvents.AVAILABLE_ROOMS_UPDATE, (rooms: RoomInfo[]) => {
      setAvailableRooms(rooms);
    });

    socket.emit(SocketEvents.GET_AVAILABLE_ROOMS);
    
    const interval = setInterval(() => setTick(t => t + 1), 10000); // Update every 10s

    return () => {
      socket.off(SocketEvents.AVAILABLE_ROOMS_UPDATE);
      clearInterval(interval);
    };
  }, [socket]);

  const handleCreate = () => {
    if (!name) return alert(t('lobby.enterNameAlert'));
    onCreate(name, { turnTimeLimit: 60 });
  };

  const handleJoin = (id?: string) => {
    const targetRoomId = id || roomId;
    if (!name || !targetRoomId) return alert(t('lobby.enterNameAndRoomAlert'));
    onJoin(targetRoomId, name);
  };

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return t('lobby.timeAgoSeconds', { count: seconds });
    const minutes = Math.floor(seconds / 60);
    return t('lobby.timeAgoMinutes', { count: minutes });
  };

  return (
    <div className="lobby">
      <h1>{t('lobby.title')}</h1>
      
      <div className="input-group">
        {isEditingName ? (
            <>
                <label>{t('lobby.yourName')}</label>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                    <input 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder={t('lobby.enterName')}
                        autoFocus
                        onKeyDown={e => {
                            if (e.key === 'Enter' && name) {
                                setIsEditingName(false);
                            }
                        }}
                    />
                    {name && (
                         <button 
                             className="link-button" 
                             onClick={() => setIsEditingName(false)}
                             title={t('lobby.save')}
                         >
                             {t('lobby.save')}
                         </button>
                    )}
                </div>
            </>
        ) : (
            <div className="user-greeting">
                <span>{t('lobby.welcome', { name })}</span>
                <button className="link-button" onClick={() => setIsEditingName(true)}>{t('lobby.changeName')}</button>
            </div>
        )}
      </div>

      {mode === 'menu' && (
        <div className="actions">
          <button onClick={handleCreate} disabled={!name}>{t('lobby.createGame')}</button>
          <button onClick={() => setMode('join')} disabled={!name}>{t('lobby.joinGame')}</button>
        </div>
      )}

      {mode === 'menu' && (
         <div className="room-list">
            <h3>{t('lobby.availableGames')}</h3>
            {availableRooms.length === 0 ? (
                <p>{t('lobby.noGames')}</p>
            ) : (
                <ul>
                    {availableRooms.map(room => (
                        <li key={room.roomId} className="room-item">
                            <span>{t('lobby.room', { id: room.roomId })}</span>
                            <span>{t('lobby.players', { count: room.playerCount })}</span>
                            <span>{t('lobby.created', { time: formatTime(room.createdAt) })}</span>
                            <button onClick={() => handleJoin(room.roomId)} disabled={!name}>{t('lobby.join')}</button>
                        </li>
                    ))}
                </ul>
            )}
         </div>
      )}

      {mode === 'join' && (
        <div className="join-form">
          <input 
            value={roomId} 
            onChange={e => setRoomId(e.target.value)} 
            placeholder={t('lobby.roomIdPlaceholder')}
          />
          <div className="actions">
            <button onClick={() => handleJoin()}>{t('lobby.join')}</button>
            <button onClick={() => setMode('menu')}>{t('lobby.back')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

