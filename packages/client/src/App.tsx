import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameSocket } from './hooks/useGameSocket';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';
import { DevTools } from './components/DevTools';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import './components/Game.css'; // Global styles for now

function App() {
  const { t, i18n } = useTranslation();
  const { 
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
  } = useGameSocket();

  const [isInGame, setIsInGame] = useState(false);
  const currentLanguage = i18n.resolvedLanguage || i18n.language;
  const currentDirection = i18n.dir(currentLanguage);

  useEffect(() => {
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentDirection;
  }, [currentLanguage, currentDirection]);

  useEffect(() => {
    setIsInGame(!!gameState);
  }, [gameState]);

  const handleCreate = async (name: string, options: any) => {
    // socket connected?
    if (!isConnected) return alert(t('app.loading'));
    await createRoom(name, options);
  };

  const handleJoin = (roomId: string, name: string) => {
    if (!isConnected) return alert(t('app.loading'));
    joinRoom(roomId, name);
  };

  if (error && !isInGame) {
      return <div className="error">{t('app.error', { error })} <button onClick={clearError}>{t('app.dismiss')}</button></div>;
  }

  if (!isConnected) {
      return <div className="loading">{t('app.loading')}</div>;
  }

  // Fix: Pass user ID, not socket ID
  const getUserId = () => localStorage.getItem('sq_user_id') || '';

  if (isInGame && gameState && socket) {
    return (
      <>
        <GameRoom 
            gameState={gameState} 
            playerId={getUserId()} 
            onAction={(action) => playAction(gameState.roomId, action)}
            onStart={() => startGame(gameState.roomId)}
            onLeave={() => leaveRoom(gameState.roomId)}
            onUpdateSettings={(settings) => updateGameSettings(gameState.roomId, settings)}
            error={error}
            onErrorClear={clearError}
        />
        <DevTools onDebugCommand={(cmd) => sendDebugCommand(gameState.roomId, cmd)} />
      </>
    );
  }

  return (
    <div className="app-container">
      <LanguageSwitcher />
      <Lobby onCreate={handleCreate} onJoin={handleJoin} socket={socket} />
    </div>
  );
}

export default App;
