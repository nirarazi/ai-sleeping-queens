import { Game } from './Game';
import { GameStatus, CardType } from '@sq/shared';
import { QUEENS_DATA } from './Deck';

describe('Game Logic', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game('test-room');
  });

  describe('Initialization', () => {
    test('should initialize with empty state', () => {
      expect(game.id).toBe('test-room');
      expect(game.status).toBe(GameStatus.LOBBY);
      expect(game.players).toHaveLength(0);
      expect(game.queens).toHaveLength(16); // Total queens
      expect(game.queens.every(q => !q.isAwake)).toBe(true);
    });

    test('should shuffle queens upon initialization', () => {
      const currentQueens = game.queens.map(q => q.name);
      const originalQueens = QUEENS_DATA.map(q => q.name);
      
      // Probability of exact match is extremely low if shuffled
      expect(currentQueens).not.toEqual(originalQueens);
    });

    test('should add players', () => {
      const p1 = game.addPlayer('p1', 'Player 1', 's1');
      expect(game.players).toHaveLength(1);
      expect(p1.id).toBe('p1');
      
      game.addPlayer('p2', 'Player 2', 's2');
      expect(game.players).toHaveLength(2);
    });

    test('should not add player if game started', () => {
      game.addPlayer('p1', 'Player 1', 's1');
      game.addPlayer('p2', 'Player 2', 's2');
      game.startGame();
      
      expect(() => {
        game.addPlayer('p3', 'Player 3', 's3');
      }).toThrow('Game already started');
    });

    test('should not add more than 5 players', () => {
      for (let i = 0; i < 5; i++) {
        game.addPlayer(`p${i}`, `Player ${i}`, `s${i}`);
      }
      expect(() => {
        game.addPlayer('p6', 'Player 6', 's6');
      }).toThrow('Game is full');
    });
  });

  describe('Start Game', () => {
    test('should start game with enough players', () => {
      game.addPlayer('p1', 'Player 1', 's1');
      game.addPlayer('p2', 'Player 2', 's2');
      
      game.startGame();
      
      expect(game.status).toBe(GameStatus.PLAYING);
      expect(game.players[0].hand).toHaveLength(5);
      expect(game.players[1].hand).toHaveLength(5);
      expect(game.deck.count).toBe(67 - 10); // 67 total cards - 10 dealt
    });

    test('should throw if not enough players', () => {
      game.addPlayer('p1', 'Player 1', 's1');
      expect(() => game.startGame()).toThrow('Not enough players');
    });
  });

  describe('Play Card', () => {
    let p1: any;
    let p2: any;

    beforeEach(() => {
      game.addPlayer('p1', 'Player 1', 's1');
      game.addPlayer('p2', 'Player 2', 's2');
      game.startGame();
      p1 = game.players.find(p => p.id === 'p1');
      p2 = game.players.find(p => p.id === 'p2');
      // Empty hands to control tests
      p1.hand = [];
      p2.hand = [];
      // Ensure it's p1's turn
      game.currentTurnIndex = game.players.findIndex(p => p.id === 'p1');
    });

    const giveCard = (player: any, type: CardType, name: string = 'Test Card', value?: number) => {
      const card = { id: 'card-' + Math.random(), type, name, value };
      player.hand.push(card);
      return card;
    };

    test('should play King to wake a queen', () => {
      const king = giveCard(p1, CardType.KING, 'Test King');
      const targetQueen = game.queens.find(q => !q.isAwake)!;

      game.handleAction({
        type: 'PLAY_CARD',
        playerId: p1.id,
        payload: { cardId: king.id, targetQueenId: targetQueen.id }
      });

      expect(targetQueen.isAwake).toBe(true);
      expect(targetQueen.ownerId).toBe(p1.id);
      expect(p1.awokenQueens).toContainEqual(targetQueen);
      expect(p1.hand).not.toContainEqual(king);
      
      // Turn logic is complex with deck refills.
      // Just verify current turn index changed or player changed
      const currentPlayer = game.players[game.currentTurnIndex];
      expect(currentPlayer.id).not.toBe(p1.id);
    });

    test('should play Knight to steal a queen', () => {
      // Setup: p2 has a queen
      const queen = game.queens[0];
      p2.wakeQueen(queen);
      
      const knight = giveCard(p1, CardType.KNIGHT);

      game.handleAction({
        type: 'PLAY_CARD',
        playerId: p1.id,
        payload: { cardId: knight.id, targetPlayerId: p2.id, targetQueenId: queen.id }
      });

      expect(p2.awokenQueens).not.toContainEqual(queen);
      expect(p1.awokenQueens).toContainEqual(queen);
      expect(queen.ownerId).toBe(p1.id);
    });

    test('should block Knight with Dragon', () => {
      const queen = game.queens[0];
      p2.wakeQueen(queen);
      
      const knight = giveCard(p1, CardType.KNIGHT);
      const dragon = giveCard(p2, CardType.DRAGON);

      game.handleAction({
        type: 'PLAY_CARD',
        playerId: p1.id,
        payload: { cardId: knight.id, targetPlayerId: p2.id, targetQueenId: queen.id }
      });

      // Queen stays with p2
      expect(p2.awokenQueens).toContainEqual(queen);
      expect(p1.awokenQueens).not.toContainEqual(queen);
      // Cards discarded
      expect(p1.hand).not.toContainEqual(knight);
      expect(p2.hand).not.toContainEqual(dragon);
      // p2 should have drawn a card (hand size 1 because dragon used, then drawn 1) -> wait, setup set hand to empty + dragon = 1. Used dragon = 0. Drawn 1 = 1.
      // But p2 hand might have been refilled by endTurn? No, it's p1's turn. p1 ends turn.
      // The defender (p2) draws immediately in the code.
      expect(p2.hand).toHaveLength(1); 
    });

    test('should play Potion to sleep a queen', () => {
      const queen = game.queens[0];
      p2.wakeQueen(queen);
      
      const potion = giveCard(p1, CardType.POTION);

      game.handleAction({
        type: 'PLAY_CARD',
        playerId: p1.id,
        payload: { cardId: potion.id, targetPlayerId: p2.id, targetQueenId: queen.id }
      });

      expect(p2.awokenQueens).not.toContainEqual(queen);
      expect(queen.isAwake).toBe(false);
      expect(queen.ownerId).toBeUndefined();
    });

    test('should block Potion with Wand', () => {
      const queen = game.queens[0];
      p2.wakeQueen(queen);
      
      const potion = giveCard(p1, CardType.POTION);
      const wand = giveCard(p2, CardType.WAND);

      game.handleAction({
        type: 'PLAY_CARD',
        playerId: p1.id,
        payload: { cardId: potion.id, targetPlayerId: p2.id, targetQueenId: queen.id }
      });

      expect(p2.awokenQueens).toContainEqual(queen);
      expect(queen.isAwake).toBe(true);
      expect(p1.hand).not.toContainEqual(potion);
      expect(p2.hand).not.toContainEqual(wand);
    });

    test('should play Jester', () => {
      const jester = giveCard(p1, CardType.JESTER);
      // Mock deck to return a number card
      const numberCard = { id: 'num1', type: CardType.NUMBER, value: 1, name: '1' };
      game.deck['cards'].push(numberCard); // Access private property via index signature or casting

      game.handleAction({
        type: 'PLAY_CARD',
        playerId: p1.id,
        payload: { cardId: jester.id }
      });

      expect(p1.hand).not.toContainEqual(jester);
      // Number 1 -> count 1 from current (p1) -> p1 gets to pick?
      // Code: targetIndex = (currentTurnIndex + (count - 1)) % players.length
      // count=1, current=0 (p1) -> target = (0 + 0) = 0 -> p1.
      expect(game.pendingQueenSelection).toBeDefined();
      expect(game.pendingQueenSelection).toBeDefined();
      expect(game.pendingQueenSelection?.playerId).toBe(p1.id);
    });

    test('should not allow playing Dragon proactively', () => {
        const dragon = giveCard(p1, CardType.DRAGON);
        expect(() => {
            game.handleAction({
                type: 'PLAY_CARD',
                playerId: p1.id,
                payload: { cardId: dragon.id }
            });
        }).toThrow('Cannot play this card directly');
    });

    test('should not allow playing Wand proactively', () => {
        const wand = giveCard(p1, CardType.WAND);
        expect(() => {
            game.handleAction({
                type: 'PLAY_CARD',
                playerId: p1.id,
                payload: { cardId: wand.id }
            });
        }).toThrow('Cannot play this card directly');
    });

    test('should throw if playing card not in hand', () => {
        expect(() => {
            game.handleAction({
                type: 'PLAY_CARD',
                playerId: p1.id,
                payload: { cardId: 'fake-card-id' }
            });
        }).toThrow('Card not in hand');
    });
  });

  describe('Discard Logic', () => {
    let p1: any;

    beforeEach(() => {
      game.addPlayer('p1', 'Player 1', 's1');
      game.addPlayer('p2', 'Player 2', 's2');
      game.startGame();
      p1 = game.players.find(p => p.id === 'p1');
      p1.hand = [];
      game.currentTurnIndex = 0;
    });

    const giveCard = (player: any, value: number) => {
      const card = { id: 'card-' + Math.random(), type: CardType.NUMBER, name: `${value}`, value };
      player.hand.push(card);
      return card;
    };

    test('should discard single number', () => {
      const c1 = giveCard(p1, 5);
      game.handleAction({
        type: 'DISCARD',
        playerId: p1.id,
        payload: { cardIds: [c1.id] }
      });
      expect(p1.hand).not.toContainEqual(c1);
    });

    test('should discard pair', () => {
      const c1 = giveCard(p1, 4);
      const c2 = giveCard(p1, 4);
      game.handleAction({
        type: 'DISCARD',
        playerId: p1.id,
        payload: { cardIds: [c1.id, c2.id] }
      });
      expect(p1.hand).not.toContainEqual(c1);
      expect(p1.hand).not.toContainEqual(c2);
    });

    test('should discard addition set (2+3=5)', () => {
      const c1 = giveCard(p1, 2);
      const c2 = giveCard(p1, 3);
      const c3 = giveCard(p1, 5);
      game.handleAction({
        type: 'DISCARD',
        playerId: p1.id,
        payload: { cardIds: [c1.id, c2.id, c3.id] }
      });
      expect(p1.hand).toHaveLength(5); // Drew back 3 cards (start 3 -> discard 3 -> draw 3 = 3, wait, hand refill logic fills to 5).
      // Start with empty, add 3 cards. Hand size 3. Discard 3. Hand size 0. End Turn -> Refill to 5.
    });

    test('should throw on invalid math', () => {
      const c1 = giveCard(p1, 2);
      const c2 = giveCard(p1, 3);
      const c3 = giveCard(p1, 6);
      expect(() => {
        game.handleAction({
          type: 'DISCARD',
          playerId: p1.id,
          payload: { cardIds: [c1.id, c2.id, c3.id] }
        });
      }).toThrow('Invalid discard combination');
    });

    test('should throw if discarding card not in hand', () => {
        const c1 = giveCard(p1, 5);
        expect(() => {
            game.handleAction({
                type: 'DISCARD',
                playerId: p1.id,
                payload: { cardIds: [c1.id, 'fake-card-id'] }
            });
        }).toThrow('Cards not in hand');
    });
  });

  describe('Special Interactions', () => {
    let p1: any;
    let p2: any;
    
    const giveCard = (player: any, type: CardType, name: string = 'Test Card') => {
      const card = { id: 'card-' + Math.random(), type, name };
      player.hand.push(card);
      return card;
    };

    beforeEach(() => {
      game.addPlayer('p1', 'Player 1', 's1');
      game.addPlayer('p2', 'Player 2', 's2');
      game.startGame();
      p1 = game.players[0];
      p2 = game.players[1];
      p1.hand = [];
      p2.hand = [];
      game.currentTurnIndex = 0;
    });

    test('Cat Queen should be blocked by Dog Queen on Wake', () => {
      const catQueen = game.queens.find(q => q.name === 'Cat Queen')!;
      const dogQueen = game.queens.find(q => q.name === 'Dog Queen')!;
      
      // p1 has Dog Queen
      p1.wakeQueen(dogQueen);
      
      // p1 tries to wake Cat Queen -> Conflict?
      // Rule: You cannot hold both Cat and Dog.
      // If p1 has Dog, and wakes Cat -> Cat stays sleeping. Turn ends.
      
      const king = giveCard(p1, CardType.KING);
      
      game.handleAction({
        type: 'PLAY_CARD',
        playerId: p1.id,
        payload: { cardId: king.id, targetQueenId: catQueen.id }
      });
      
      expect(catQueen.isAwake).toBe(false);
      expect(p1.awokenQueens).not.toContainEqual(catQueen);
      expect(p1.awokenQueens).toContainEqual(dogQueen);
    });

    test('Rose Queen should trigger bonus pick', () => {
      const roseQueen = game.queens.find(q => q.name === 'Rose Queen')!;
      const king = giveCard(p1, CardType.KING);
      
      game.handleAction({
        type: 'PLAY_CARD',
        playerId: p1.id,
        payload: { cardId: king.id, targetQueenId: roseQueen.id }
      });
      
      expect(p1.awokenQueens).toContainEqual(roseQueen);
      expect(game.pendingQueenSelection).toBeDefined();
      expect(game.pendingQueenSelection?.playerId).toBe(p1.id);
      
      // Turn should NOT have ended yet
      expect(game.players[game.currentTurnIndex].id).toBe(p1.id);
    });

    test('Tie-Dye King should trigger bonus pick', () => {
      const king = giveCard(p1, CardType.KING, 'tie-dye');
      const queen = game.queens.find(q => !q.isAwake)!;
      
      game.handleAction({
        type: 'PLAY_CARD',
        playerId: p1.id,
        payload: { cardId: king.id, targetQueenId: queen.id }
      });
      
      expect(p1.awokenQueens).toContainEqual(queen);
      expect(game.pendingQueenSelection).toBeDefined();
    });

    test('Strawberry Queen cannot be stolen', () => {
        const strawberry = game.queens.find(q => q.name === 'Strawberry Queen')!;
        p2.wakeQueen(strawberry);
        
        const knight = giveCard(p1, CardType.KNIGHT);
        
        expect(() => {
            game.handleAction({
                type: 'PLAY_CARD',
                playerId: p1.id,
                payload: { cardId: knight.id, targetPlayerId: p2.id, targetQueenId: strawberry.id }
            });
        }).toThrow('Strawberry Queen cannot be stolen');
    });

    test('Strawberry Queen cannot be put to sleep', () => {
        const strawberry = game.queens.find(q => q.name === 'Strawberry Queen')!;
        p2.wakeQueen(strawberry);
        
        const potion = giveCard(p1, CardType.POTION);
        
        expect(() => {
            game.handleAction({
                type: 'PLAY_CARD',
                playerId: p1.id,
                payload: { cardId: potion.id, targetPlayerId: p2.id, targetQueenId: strawberry.id }
            });
        }).toThrow('Strawberry Queen cannot be put to sleep');
    });

    test('Stealing Cat when holding Dog should fail (conflict)', () => {
        const cat = game.queens.find(q => q.name === 'Cat Queen')!;
        const dog = game.queens.find(q => q.name === 'Dog Queen')!;
        
        p1.wakeQueen(dog);
        p2.wakeQueen(cat);
        
        const knight = giveCard(p1, CardType.KNIGHT);
        
        game.handleAction({
            type: 'PLAY_CARD',
            playerId: p1.id,
            payload: { cardId: knight.id, targetPlayerId: p2.id, targetQueenId: cat.id }
        });
        
        // Attack happens but fails to transfer queen due to conflict
        expect(p2.awokenQueens).toContainEqual(cat);
        expect(p1.awokenQueens).toContainEqual(dog);
        expect(p1.hand).not.toContainEqual(knight);
    });

    test('Jester reveals non-number: Player keeps card', () => {
        const jester = giveCard(p1, CardType.JESTER);
        
        // Mock deck to return a KING
        const king = { id: 'king1', type: CardType.KING, name: 'Test King' };
        game.deck['cards'].push(king);
        
        game.handleAction({
            type: 'PLAY_CARD',
            playerId: p1.id,
            payload: { cardId: jester.id }
        });
        
        expect(p1.hand).toContainEqual(king);
        // Turn should NOT end if Jester gives a card? 
        // Checking logic: `if (revealedCard.type !== CardType.NUMBER) { player.addCard(revealedCard); return false; }`
        // `shouldEndTurn = false`
        expect(game.players[game.currentTurnIndex].id).toBe(p1.id);
    });

    test('Deck should reshuffle when empty', () => {
        // Empty deck
        game.deck['cards'] = [];
        // Add cards to discard
        const d1 = { id: 'd1', type: CardType.NUMBER, value: 1, name: '1' };
        game.discardPile.push(d1);
        
        const c1 = { id: 'c1-discard', type: CardType.NUMBER, value: 5, name: '5' };
        p1.hand.push(c1);
        
        game.handleAction({
            type: 'DISCARD',
            playerId: p1.id,
            payload: { cardIds: [c1.id] }
        });
        
        // Logic:
        // 1. Discard c1 -> discardPile = [d1, c1]
        // 2. Draw 1 card (to replace c1) -> Deck empty -> Reshuffle -> Deck = [d1, c1] (shuffled) -> Draw 1 -> Hand has 1. Deck has 1.
        // 3. End Turn -> Refill to 5. -> Draw remaining 1. -> Hand has 2. Deck has 0.
        
        expect(game.discardPile).toHaveLength(0);
        expect(game.deck.count).toBe(0);
        expect(p1.hand).toHaveLength(2);
        expect(p1.hand.map((c: any) => c.id).sort()).toEqual(['c1-discard', 'd1'].sort());
    });

    test('Validation: Cannot play out of turn', () => {
        expect(() => {
            game.handleAction({
                type: 'PLAY_CARD',
                playerId: p2.id, // p1 turn
                payload: { cardId: 'dummy' }
            });
        }).toThrow('Not your turn');
    });

    test('Redundant Action: Potion on Sleeping Queen (should fail)', () => {
        // Queen is already sleeping (center), cannot potion it.
        // But potion targets a PLAYER and their QUEEN. 
        // If queen is sleeping, she is not owned by a player.
        // If potion targetPlayerId is provided, we check if they have the queen.
        
        const queen = game.queens.find(q => !q.isAwake)!; // Sleeping
        const potion = giveCard(p1, CardType.POTION);
        
        expect(() => {
            game.handleAction({
                type: 'PLAY_CARD',
                playerId: p1.id,
                payload: { cardId: potion.id, targetPlayerId: p2.id, targetQueenId: queen.id }
            });
        }).toThrow('Target does not have queen');
    });

    test('Redundant Action: Knight on Stolen Queen (already have it?)', () => {
        // If p1 already has the queen, can they steal it from themselves? No, targetPlayerId must be other.
        // If p1 tries to steal from p2, but p2 doesn't have it.
        
        const queen = game.queens[0];
        // Nobody has it
        const knight = giveCard(p1, CardType.KNIGHT);
        
        expect(() => {
            game.handleAction({
                type: 'PLAY_CARD',
                playerId: p1.id,
                payload: { cardId: knight.id, targetPlayerId: p2.id, targetQueenId: queen.id }
            });
        }).toThrow('Target player does not have that queen');
    });
  });

  describe('Win Conditions', () => {
    let p1: any;
    
    beforeEach(() => {
      game.addPlayer('p1', 'Player 1', 's1');
      game.addPlayer('p2', 'Player 2', 's2');
      game.startGame();
      p1 = game.players[0];
      // Force p1's turn
      game.currentTurnIndex = game.players.findIndex(p => p.id === 'p1');
    });

    test('should win with enough points (2 players -> 50 points)', () => {
        // 2 players: need 50 points or 5 queens
        
        // Manually give queens to p1 to reach 50 points
        // Heart Queen (20) + Book Queen (15) + Dog Queen (15) = 50
        const q1 = game.queens.find(q => q.name === 'Heart Queen')!;
        const q2 = game.queens.find(q => q.name === 'Book Queen')!;
        const q3 = game.queens.find(q => q.name === 'Dog Queen')!;
        
        p1.wakeQueen(q1);
        p1.wakeQueen(q2);
        p1.wakeQueen(q3);
        
        // Trigger win check (usually happens after action)
        // We can call checkWinCondition via a dummy action or exposing it.
        // Or just simulate an action.
        
        // Let's simulate a play card action that doesn't change much but triggers check
        const card = { id: 'dummy', type: CardType.NUMBER, value: 5, name: '5' };
        p1.hand.push(card);
        
        game.handleAction({
            type: 'DISCARD',
            playerId: p1.id,
            payload: { cardIds: ['dummy'] }
        });
        
        expect(game.status).toBe(GameStatus.FINISHED);
        expect(game.winnerId).toBe(p1.id);
    });

    test('should win with enough queens (2 players -> 5 queens)', () => {
        // 2 players: need 5 queens
        const queens = game.queens.slice(0, 5);
        queens.forEach(q => p1.wakeQueen(q));
        
        const card = { id: 'dummy', type: CardType.NUMBER, value: 5, name: '5' };
        p1.hand.push(card);
        
        game.handleAction({
            type: 'DISCARD',
            playerId: p1.id,
            payload: { cardIds: ['dummy'] }
        });
        
        expect(game.status).toBe(GameStatus.FINISHED);
        expect(game.winnerId).toBe(p1.id);
    });
    
    test('should end game when all queens are awake', () => {
        // Wake all queens distributed among players
        // p1: 100 pts, p2: 0 pts
        const q1 = game.queens.find(q => q.name === 'Heart Queen')!; // 20
        p1.wakeQueen(q1);
        
        // Wake rest for p2 (but make sure p1 has more points)
        // Actually p2 might win if they have more points.
        // Let's just wake all.
        game.queens.forEach(q => {
            if (!q.isAwake) {
               // Give low value queens to p2
               game.players[1].wakeQueen(q);
            }
        });
        
        // Trigger check
        const card = { id: 'dummy', type: CardType.NUMBER, value: 5, name: '5' };
        p1.hand.push(card);
        game.handleAction({
            type: 'DISCARD',
            playerId: p1.id,
            payload: { cardIds: ['dummy'] }
        });
        
        expect(game.status).toBe(GameStatus.FINISHED);
        // p1 has Heart (20). p2 has rest (~100+). So p2 should win?
        // Let's calculate who has more.
        const p1Score = p1.score;
        const p2Score = game.players[1].score;
        const winner = p1Score > p2Score ? p1 : game.players[1];
        
        expect(game.winnerId).toBe(winner.id);
    });
  });

  describe('Connectivity', () => {
      test('should handle player disconnect', () => {
          game.addPlayer('p1', 'Player 1', 's1');
          game.removePlayer('p1'); // Lobby -> removal
          expect(game.players).toHaveLength(0);
          
          game.addPlayer('p1', 'Player 1', 's1');
          game.addPlayer('p2', 'Player 2', 's2');
          game.addPlayer('p3', 'Player 3', 's3');
          game.startGame();
          
          // Simulate network disconnect
          game.disconnectPlayer('s1'); 
          expect(game.players).toHaveLength(3); // Still in game
          const p1 = game.players.find(p => p.id === 'p1');
          expect(p1?.isConnected).toBe(false);
          
          // Simulate explicit leave
          game.removePlayer('p2');
          expect(game.players).toHaveLength(2);
          expect(game.players.find(p => p.id === 'p2')).toBeUndefined();
      });
  });
});
