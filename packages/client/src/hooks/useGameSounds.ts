import { useEffect, useRef } from 'react';
import { GameState, GameStatus, CardType } from '@sq/shared';
import { soundManager } from '../utils/SoundManager';

export function useGameSounds(gameState: GameState | null, playerId: string) {
  const prevGameStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    if (!gameState) return;

    const prevGameState = prevGameStateRef.current;
    
    // If it's the first load, just sync ref and return to avoid playing stale sounds
    if (!prevGameState) {
        prevGameStateRef.current = gameState;
        return;
    }

    // 1. Game Start
    if (prevGameState.status === GameStatus.LOBBY && gameState.status === GameStatus.PLAYING) {
        // soundManager.playGameStart();
    }

    // 2. Turn Change
    if (prevGameState.currentTurnPlayerId !== gameState.currentTurnPlayerId) {
        if (gameState.currentTurnPlayerId === playerId) {
            soundManager.playTurnNotification();
        }
    }

    // Check if any queen woke up in this update
    const wokenQueens: { name: string, id: string }[] = [];
    gameState.queens.forEach(queen => {
        const prevQueen = prevGameState.queens.find(q => q.id === queen.id);
        if (prevQueen && !prevQueen.isAwake && queen.isAwake) {
            wokenQueens.push({ name: queen.name, id: queen.id });
        }
    });
    
    // 3. Reactive Cards (Dragon/Wand) Detection - Needed for Knight sound logic
    // These are discarded automatically during a turn resolution.
    const prevDiscardLen = prevGameState.discardPile.length;
    const currDiscardLen = gameState.discardPile.length;
    let defenseCardPlayed = false;
    
    if (currDiscardLen > prevDiscardLen) {
        const newCards = gameState.discardPile.slice(prevDiscardLen);
        newCards.forEach(card => {
            // Reactive cards are usually discarded as a result of defense
            if (card.type === CardType.DRAGON) {
                setTimeout(() => soundManager.playCardSound(CardType.DRAGON), 600);
                defenseCardPlayed = true;
            }
            if (card.type === CardType.WAND) {
                setTimeout(() => soundManager.playCardSound(CardType.WAND), 600);
                defenseCardPlayed = true;
            }
        });
    }

    // 4. Action Sounds (Play Card)
    if (gameState.lastAction && gameState.lastAction !== prevGameState.lastAction) {
        if (gameState.lastAction.type === 'PLAY_CARD') {
             const cardId = gameState.lastAction.payload?.cardId;
             // Find the card in the previous state's player hand to identify type
             const playedCard = prevGameState.players
                .find(p => p.id === gameState.lastAction?.playerId)
                ?.hand.find(c => c.id === cardId);

             if (playedCard) {
                 const isMyAction = gameState.lastAction.playerId === playerId;
                 const isPreSelectedSound = playedCard.type === CardType.KING || playedCard.type === CardType.KNIGHT;
                 
                 // Special handling for Knight Attack Success
                 let queenStolen = false;
                 if (playedCard.type === CardType.KNIGHT) {
                      const targetQueenId = gameState.lastAction.payload?.targetQueenId;
                      if (targetQueenId) {
                          const prevQueen = prevGameState.queens.find(q => q.id === targetQueenId);
                          const currQueen = gameState.queens.find(q => q.id === targetQueenId);
                          if (prevQueen?.ownerId && currQueen?.ownerId && prevQueen.ownerId !== currQueen.ownerId) {
                              queenStolen = true;
                          }
                      }
                 }
                 
                 // Check for Conflict Failure (Cat/Dog)
                 let conflictFailed = false;
                 if (playedCard.type === CardType.KING || playedCard.type === CardType.KNIGHT) {
                     const targetQueenId = gameState.lastAction.payload?.targetQueenId;
                     if (targetQueenId) {
                         const targetQueen = gameState.queens.find(q => q.id === targetQueenId);
                         const player = gameState.players.find(p => p.id === gameState.lastAction?.playerId);
                         
                         if (player && targetQueen) {
                             const hasCat = player.awokenQueens.some(q => q.name.includes('Cat'));
                             const hasDog = player.awokenQueens.some(q => q.name.includes('Dog'));
                             const isCat = targetQueen.name.includes('Cat');
                             const isDog = targetQueen.name.includes('Dog');

                             if ((hasCat && isDog) || (hasDog && isCat)) {
                                 conflictFailed = true;
                             }
                         }
                     }
                 }

                 // Special handling for King Wake Success
                 let queenWoken = false;
                 if (playedCard.type === CardType.KING) {
                     if (wokenQueens.length > 0) {
                         queenWoken = true;
                     }
                 }

                 // Sound Logic Priority
                 if (conflictFailed) {
                     const targetQueenId = gameState.lastAction.payload?.targetQueenId;
                     const targetQueen = gameState.queens.find(q => q.id === targetQueenId);
                     if (targetQueen?.name.includes('Dog')) {
                          soundManager.playQueenWake('Dog Queen'); // Force dog sound
                     } else {
                          soundManager.playQueenWake('Cat Queen'); // Force cat sound
                     }
                 } else if (queenStolen) {
                      soundManager.playAttack();
                 } else if (defenseCardPlayed && playedCard.type === CardType.KNIGHT) {
                      // Do NOTHING for Knight if defended. 
                      // Dragon sound plays from step 3. 
                      // Knight sound played on selection.
                      // So we silence the "played" sound here.
                      if (isMyAction) {
                          soundManager.playCardSound('NUMBER'); // Dispose for my card removal
                      }
                 } else if (queenWoken) {
                      // Handled by wake logic below
                 } else if (isMyAction && isPreSelectedSound) {
                     soundManager.playCardSound('NUMBER'); // Plays 'dispose' for the player who already heard the selection sound
                 } else {
                     soundManager.playCardSound(playedCard.type);
                 }
             }
        } else if (gameState.lastAction.type === 'DISCARD') {
            soundManager.playCardSound('NUMBER'); // Dispose sound
        }
    }

    // 5. Queen State Changes (Wake/Sleep)
    gameState.queens.forEach(queen => {
        const prevQueen = prevGameState.queens.find(q => q.id === queen.id);
        if (!prevQueen) return;

        // Waking up
        if (!prevQueen.isAwake && queen.isAwake) {
             // Normal wake
             setTimeout(() => soundManager.playQueenWake(queen.name), 300);
        }
        
        // Going to sleep
        if (prevQueen.isAwake && !queen.isAwake) {
            setTimeout(() => soundManager.playQueenSleep(), 300);
        }
    });

    // 6. Game Over
    if (prevGameState.status !== GameStatus.FINISHED && gameState.status === GameStatus.FINISHED) {
        if (gameState.winnerId === playerId) {
            soundManager.playWin();
        }
    }

    prevGameStateRef.current = gameState;
  }, [gameState, playerId]);
}
