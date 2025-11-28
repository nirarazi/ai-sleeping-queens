import React, { useState, useEffect, useRef } from 'react';
import { GameState, Player, Card as ICard, CardType, Queen, CreateRoomOptions } from '@sq/shared';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { useGameSounds } from '../hooks/useGameSounds';
import { soundManager } from '../utils/SoundManager';
import { getQueenBackImageUrl } from '../utils/cardImages';
import { LanguageSwitcher } from './LanguageSwitcher';
import './Game.css';
import './Queens.css';

const getQueenClass = (name: string) => {
  const map: Record<string, string> = {
    'Book Queen': 'queen-book',
    'Butterfly Queen': 'queen-butterfly',
    'Cake Queen': 'queen-cake',
    'Cat Queen': 'queen-cat',
    'Dog Queen': 'queen-dog',
    'Heart Queen': 'queen-heart',
    'Ice Cream Queen': 'queen-ice-cream',
    'Ladybug Queen': 'queen-ladybug',
    'Sunflower Queen': 'queen-sunflower',
    'Moon Queen': 'queen-moon',
    'Pancake Queen': 'queen-pancake',
    'Peacock Queen': 'queen-peacock',
    'Rainbow Queen': 'queen-rainbow',
    'Rose Queen': 'queen-rose',
    'Starfish Queen': 'queen-starfish',
    'Strawberry Queen': 'queen-strawberry',
  };
  return map[name] || '';
};

interface GameRoomProps {
  gameState: GameState;
  playerId: string; // My socket ID
  onAction: (action: any) => void;
  onStart: () => void;
  onLeave: () => void;
  onUpdateSettings?: (settings: CreateRoomOptions) => void;
  error?: string | null;
  onErrorClear?: () => void;
}

export const GameRoom: React.FC<GameRoomProps> = ({ gameState, playerId, onAction, onStart, onLeave, onUpdateSettings, error, onErrorClear }) => {
  const { t } = useTranslation();
  useGameSounds(gameState, playerId);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedQueenId, setSelectedQueenId] = useState<string | null>(null);
  const [selectedTargetPlayerId, setSelectedTargetPlayerId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const [turnTimeLimit, setTurnTimeLimit] = useState(gameState.turnTimeLimit || 60);
  const isHost = gameState.hostId === playerId;

  useEffect(() => {
      if (gameState.turnTimeLimit) {
          setTurnTimeLimit(gameState.turnTimeLimit);
      }
  }, [gameState.turnTimeLimit]);

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = Number(e.target.value);
      setTurnTimeLimit(newVal);
      if (onUpdateSettings && isHost) {
          onUpdateSettings({ turnTimeLimit: newVal });
      }
  };

  const handlePresetTime = (time: number) => {
    setTurnTimeLimit(time);
    if (onUpdateSettings && isHost) {
        onUpdateSettings({ turnTimeLimit: time });
    }
  };

  useEffect(() => {
    if (!gameState.turnDeadline) {
        setTimeLeft(null);
        lastTickRef.current = null;
        return;
    }

    const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((gameState.turnDeadline! - now) / 1000));
        
        const limit = gameState.turnTimeLimit || 60;
        const tickThreshold = Math.max(3, Math.round(limit * 0.15));

        if (remaining <= tickThreshold && remaining > 0 && lastTickRef.current !== remaining) {
            soundManager.playTick();
            lastTickRef.current = remaining;
        }
        
        setTimeLeft(remaining);
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 200);
    return () => clearInterval(interval);
  }, [gameState.turnDeadline]);

  const myPlayer = gameState.players.find((p: Player) => p.id === playerId);
  
  const pendingSelection = gameState.pendingQueenSelection;
  const isMySelectionTurn = pendingSelection?.playerId === playerId;
  // It's my normal turn ONLY if there is no pending selection blocking the game
  const isMyTurn = !pendingSelection && gameState.currentTurnPlayerId === playerId;

  const selectedCards = selectedCardIds.map(id => myPlayer?.hand.find(c => c.id === id)).filter((c): c is ICard => !!c);
  const singleSelectedCard = selectedCards.length === 1 ? selectedCards[0] : null;

  const isKingSelected = singleSelectedCard?.type === CardType.KING;
  const isKnightSelected = singleSelectedCard?.type === CardType.KNIGHT;
  const isPotionSelected = singleSelectedCard?.type === CardType.POTION;
  
  // Helper to determine if play should be disabled due to missing target
  const isPlayDisabled = () => {
    if (selectedCardIds.length === 0) return true;
    
    // King needs a target (sleeping queen)
    if (isKingSelected && !selectedQueenId) return true;
    
    // Knight needs a target (opponent's queen)
    if (isKnightSelected && !selectedQueenId) return true;
    
    // Potion needs a target (opponent's queen)
    if (isPotionSelected && !selectedQueenId) return true;
    
    return false;
  };

  const getInstructionMessage = () => {
    if (!isMyTurn) return null;
    if (isKingSelected && !selectedQueenId) return t('game.selectQueen');
    if (isKnightSelected && !selectedQueenId) return t('game.selectQueenToSteal');
    if (isPotionSelected && !selectedQueenId) return t('game.selectQueenToSleep');
    return null;
  };

  const getLastActionDescription = () => {
      if (!gameState.lastAction) return null;
      const { type, payload, playerId } = gameState.lastAction;
      const player = gameState.players.find(p => p.id === playerId);
      const playerName = player?.name || 'Unknown';

      if (type === 'PLAY_CARD') {
          const cardType = payload?.cardType;
          // Translate queen name if available
          const queenKey = payload?.targetQueenName;
          const targetQueenName = queenKey ? t(`queens.${queenKey}`) : queenKey;
          const targetPlayerName = payload?.targetPlayerName;

          if (cardType === 'KING') {
              return t('game.action.KING', { player: playerName, queen: targetQueenName });
          }
          if (cardType === 'KNIGHT') {
              return t('game.action.KNIGHT', { player: playerName, target: targetPlayerName, queen: targetQueenName });
          }
          if (cardType === 'POTION') {
              return t('game.action.POTION', { player: playerName, target: targetPlayerName, queen: targetQueenName });
          }
          if (cardType === 'JESTER') {
              return t('game.action.JESTER', { player: playerName });
          }
           if (cardType === 'WAND') {
              return t('game.action.WAND', { player: playerName });
          }
           if (cardType === 'DRAGON') {
              return t('game.action.DRAGON', { player: playerName });
          }
      }
      
      if (type === 'DISCARD') {
          return t('game.action.DISCARD', { player: playerName, count: payload?.count || 1 });
      }

      if (type === 'WAKE_QUEEN') {
           const queenKey = payload?.targetQueenName;
           const targetQueenName = queenKey ? t(`queens.${queenKey}`) : queenKey;
           return t('game.action.WAKE_QUEEN', { player: playerName, queen: targetQueenName });
      }

      return t('game.lastAction', { action: type, name: playerName });
  };
  
  const handleCardClick = (card: ICard) => {
    if (selectedCardIds.includes(card.id)) {
      setSelectedCardIds(selectedCardIds.filter((id: string) => id !== card.id));
    } else {
      if (card.type === CardType.KING || card.type === CardType.KNIGHT) {
        soundManager.playCardSound(card.type);
      }
      setSelectedCardIds([...selectedCardIds, card.id]);
    }
  };

  const handleQueenClick = (queen: Queen) => {
    setSelectedQueenId(queen.id);
    if (queen.ownerId) setSelectedTargetPlayerId(queen.ownerId);
  };

  const handleWakeQueen = () => {
      if (!selectedQueenId) return;
      onAction({
          type: 'WAKE_QUEEN',
          payload: { targetQueenId: selectedQueenId }
      });
      setSelectedQueenId(null);
  };

  const handlePlay = () => {
    console.log("Handle Play Triggered");
    if (selectedCardIds.length === 0) return;
    
    const card = myPlayer?.hand.find(c => c.id === selectedCardIds[0]);
    if (!card) return;

    // Debug log
    console.log("Playing action", {
        cardType: card.type,
        selectedCardIds,
        selectedTargetPlayerId,
        selectedQueenId
    });

    // Simple single card play logic
    if (selectedCardIds.length === 1 && 
        card.type !== CardType.NUMBER && 
        card.type !== CardType.DRAGON && 
        card.type !== CardType.WAND) {
        onAction({
            type: 'PLAY_CARD',
            payload: {
                cardId: card.id,
                targetPlayerId: selectedTargetPlayerId,
                targetQueenId: selectedQueenId
            }
        });
    } else {
        // Discard Logic (Numbers)
        onAction({
            type: 'DISCARD',
            payload: { cardIds: selectedCardIds }
        });
    }
    
    // Reset selection
    setSelectedCardIds([]);
    setSelectedQueenId(null);
    setSelectedTargetPlayerId(null);
  };

  if (gameState.status === 'LOBBY') {
    const copyRoomId = () => {
        navigator.clipboard.writeText(gameState.roomId);
        alert(t('game.copied'));
    };

    return (
      <div className="lobby-wait">
        <h1>{t('lobby.title')}</h1>
        <h2>{t('game.waitingForPlayers')}</h2>
        
        <div className="room-id-display">
            <span>{t('game.roomId')}<strong>{gameState.roomId}</strong></span>
            <button onClick={copyRoomId} className="copy-btn" title={t('game.copy')}>📋</button>
        </div>

        <div className="players-list">
            <h3>{t('game.joinedPlayers', { count: gameState.players.length })}</h3>
            <ul>
              {gameState.players.map((p: Player) => (
                  <li key={p.id}>
                      <span className="player-avatar">👤</span>
                      {p.name}
                      {p.id === playerId && ` (${t('game.you')})`}
                      {!p.isConnected && ` (${t('game.disconnected')})`}
                  </li>
              ))}
            </ul>
        </div>

        <div className="game-settings" style={{ margin: '0 auto 20px', maxWidth: '400px' }}>
            <label htmlFor="turnTimeLimit">{t('game.turnTimeLimit')}: {turnTimeLimit}s</label>
            <input 
              type="range" 
              id="turnTimeLimit" 
              min="5" 
              max="60" 
              value={turnTimeLimit} 
              onChange={handleSettingsChange} 
              disabled={!isHost}
            />
            {isHost && (
                <div className="settings-presets">
                    <button onClick={() => handlePresetTime(5)} className={turnTimeLimit === 5 ? 'active' : ''}>{t('game.timePresets.quick')}</button>
                    <button onClick={() => handlePresetTime(30)} className={turnTimeLimit === 30 ? 'active' : ''}>{t('game.timePresets.normal')}</button>
                    <button onClick={() => handlePresetTime(60)} className={turnTimeLimit === 60 ? 'active' : ''}>{t('game.timePresets.slow')}</button>
                </div>
            )}
            {!isHost && <p className="settings-note">{t('game.onlyHostCanChangeSettings')}</p>}
        </div>

        <div className="lobby-controls">
            {gameState.players.length >= 2 && isHost && (
                <button className="start-btn" onClick={onStart}>{t('game.startGame')}</button>
            )}
            {gameState.players.length >= 2 && !isHost && (
                 <p className="waiting-msg">{t('game.waitingForHost')}</p>
            )}
            <button className="leave-btn" onClick={onLeave}>{t('game.leaveRoom')}</button>
        </div>
        {gameState.players.length < 2 && (
             <p className="waiting-msg">{t('game.waitingMsg')}</p>
        )}
      </div>
    );
  }
  
  if (gameState.status === 'FINISHED') {
      const winner = gameState.players.find((p: Player) => p.id === gameState.winnerId);
      return (
          <div className="game-over">
              <h2>{t('game.gameOver')}</h2>
              {winner ? (
                  <h3 className="winner-announcement">{t('game.winner', { name: winner.name })}</h3>
              ) : (
                  <h3>{t('game.gameEnded')}</h3>
              )}
              
              <div className="final-scores">
                  <h4>{t('game.finalStandings')}</h4>
                  <div className="scores-list">
                      {gameState.players
                          .sort((a: Player, b: Player) => b.score - a.score)
                          .map((p: Player) => (
                              <div key={p.id} className={`score-entry ${p.id === gameState.winnerId ? 'winner' : ''}`}>
                                  <div className="score-header">
                                      <span className="player-name">{p.name}</span>
                                      <span className="player-details">{t('game.finalScoreDetails', { score: p.score, queens: p.awokenQueens.length })}</span>
                                  </div>
                                  <div className="mini-queens">
                                      {p.awokenQueens.map((q: Queen) => (
                                          <div key={q.id} className={`card type-queen mini ${getQueenClass(q.name)}`}>
                                              <div className="card-top">♕</div>
                                              <div className="card-name">{q.name}<br/>({q.points})</div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ))}
                  </div>
              </div>
              <button className="restart-btn" onClick={() => window.location.reload()}>{t('game.playAgain')}</button>
          </div>
      );
  }

  const getStatusText = () => {
      if (pendingSelection) {
          const pendingPlayer = gameState.players.find(p => p.id === pendingSelection.playerId);
          if (isMySelectionTurn) return t('game.yourTurnWake');
          return t('game.waitingForWake', { name: pendingPlayer?.name });
      }
      if (isMyTurn) return t('game.yourTurn');
      const currentTurnPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);
      return t('game.waitingFor', { name: currentTurnPlayer?.name });
  };

  return (
    <div className="game-room">
      {error && (
        <div className="error-overlay">
          <div className="error-box">
            <h3>{t('game.actionFailed')}</h3>
            <p>{error}</p>
            <button onClick={onErrorClear}>{t('app.dismiss')}</button>
          </div>
        </div>
      )}
      <div className="header">
          <div className="room-info">
              <button className="leave-btn-small" onClick={onLeave}>✕</button>
              <h2>{t('game.room', { id: gameState.roomId })}</h2>
          </div>
          
          <div className={`turn-status ${isMyTurn || isMySelectionTurn ? 'my-turn' : 'others-turn'}`}>
             <span className="status-text">{getStatusText()}</span>
             {timeLeft !== null && (
                <div className={`timer-display ${timeLeft < 10 ? 'timer-urgent' : ''}`}>
                    ⏱️ {timeLeft}s
                </div>
             )}
             {gameState.lastAction && (
                 <div className="last-action-highlight">
                     {getLastActionDescription()}
                 </div>
             )}
          </div>

          <div className="mini-decks-container">
            <div className="mini-pile" title={t('game.drawPile', { count: gameState.drawPileCount })}>
               <span>Draw ({gameState.drawPileCount})</span>
               <Card faceDown className="micro-card" />
            </div>
            <div className="mini-pile" title={t('game.discardPile')}>
               <span>Discard</span>
               {gameState.discardPile.length > 0 ? (
                    <Card card={gameState.discardPile[gameState.discardPile.length - 1]} className="micro-card" />
               ) : <div className="micro-card empty-pile-micro">{t('game.empty')}</div>}
            </div>
          </div>
          
          <LanguageSwitcher />
      </div>

      <div className="opponents">
        {gameState.players.filter((p: Player) => p.id !== playerId).map((p: Player) => (
          <div key={p.id} className={`opponent ${gameState.currentTurnPlayerId === p.id ? 'active-turn' : ''} ${!p.isConnected ? 'disconnected' : ''}`}>
            <h3>
                {p.name}
                {!p.isConnected && <span className="status-indicator"> ⚠️</span>}
            </h3>
            <p>{t('game.score', { score: p.score })}</p>
            <div className="mini-queens">
               {p.awokenQueens.map((q: Queen) => (
                   <div key={q.id} 
                        className={`card type-queen mini ${selectedQueenId === q.id ? 'selected' : ''} ${getQueenClass(q.name)}`}
                        onClick={() => handleQueenClick(q)}
                   >
                       <div className="card-top">♕</div>
                       <div className="card-name">{q.name}<br/>({q.points})</div>
                   </div>
               ))}
            </div>
          </div>
        ))}
      </div>

      <div className="queens-grid">
        {gameState.queens.map((q: Queen) => (
          q.isAwake ? (
            <div key={q.id} className="card-placeholder" />
          ) : (
            <Card key={q.id} faceDown backImage={getQueenBackImageUrl()}
                  selected={selectedQueenId === q.id}
                  onClick={() => handleQueenClick(q)} 
            />
          )
        ))}
      </div>

      <div className={`my-area ${isMyTurn || isMySelectionTurn ? 'active-turn' : 'disabled-turn'}`}>
        <div className="controls">
          {isMyTurn && <button onClick={handlePlay} disabled={isPlayDisabled()}>{t('game.playDiscard')}</button>}
          {getInstructionMessage() && <div className="instruction-tooltip">{getInstructionMessage()}</div>}
          {isMySelectionTurn && <button onClick={handleWakeQueen} disabled={!selectedQueenId} className="special-action-btn">{t('game.wakeQueen')}</button>}
        </div>
        
        <div className="my-queens">
            <h4>{t('game.myQueens', { score: myPlayer?.score })}</h4>
            <div className="queens-row">
                {myPlayer?.awokenQueens.map((q: Queen) => (
                    <div key={q.id} className={`card type-queen ${getQueenClass(q.name)}`}>
                        <div className="card-top">♕</div>
                        <div className="card-name">{q.name}<br/>({q.points})</div>
                    </div>
                ))}
                {Array.from({ length: Math.max(0, 5 - (myPlayer?.awokenQueens.length || 0)) }).map((_, i) => (
                    <div key={`placeholder-${i}`} className="card-placeholder" />
                ))}
            </div>
        </div>

        <div className="hand">
          {myPlayer?.hand.map((card: ICard) => (
            <Card 
              key={card.id} 
              card={card} 
              selected={selectedCardIds.includes(card.id)}
              onClick={() => handleCardClick(card)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
