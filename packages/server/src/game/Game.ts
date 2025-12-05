import { GameState, GameStatus, Queen, Card, CardType, GameAction, DebugCommand, CreateRoomOptions } from '@sq/shared';
import { Deck, QUEENS_DATA } from './Deck';
import { Player } from './Player';
import { v4 as uuidv4 } from 'uuid';

export class Game {
  public id: string;
  public hostId: string = '';
  public players: Player[] = [];
  public deck: Deck;
  public queens: Queen[] = [];
  public discardPile: Card[] = [];
  public status: GameStatus = GameStatus.LOBBY;
  public currentTurnIndex: number = 0;
  public lastAction?: GameAction;
  public winnerId?: string;
  public pendingQueenSelection?: { playerId: string; picksRemaining?: number };
  public createdAt: number;

  // Turn Timer
  public turnDurationMs: number;
  public turnDeadline?: number;
  private turnTimer: NodeJS.Timeout | null = null;
  private onStateChange?: (state: GameState) => void;

  constructor(id: string, onStateChange?: (state: GameState) => void, options?: CreateRoomOptions) {
    this.id = id;
    this.deck = new Deck();
    this.createdAt = Date.now();
    this.onStateChange = onStateChange;

    this.turnDurationMs = 60000; // Default
    if (options) {
      this.updateSettings(options);
    }

    this.initializeQueens();
  }

  public updateSettings(options: CreateRoomOptions, requestingPlayerId?: string) {
    console.log('Game.updateSettings called', { options, requestingPlayerId, hostId: this.hostId });
    if (requestingPlayerId && requestingPlayerId !== this.hostId) {
      console.error('Host ID mismatch', { expected: this.hostId, received: requestingPlayerId });
      throw new Error('Only host can update settings');
    }
    if (options.turnTimeLimit) {
      const limit = options.turnTimeLimit;
      const clampedLimit = Math.max(5, Math.min(60, limit));
      this.turnDurationMs = clampedLimit * 1000;
      console.log('Turn duration updated to', this.turnDurationMs);
    }
  }

  private startTurnTimer() {
    this.clearTurnTimer();
    this.turnDeadline = Date.now() + this.turnDurationMs;

    this.turnTimer = setTimeout(() => {
      this.handleTurnTimeout();
    }, this.turnDurationMs);
  }

  private clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.turnDeadline = undefined;
  }

  private handleTurnTimeout() {
    const currentPlayer = this.players[this.currentTurnIndex];
    if (currentPlayer) {
      console.log(`Turn timeout for player ${currentPlayer.name}`);
      // Clear any pending queen selection to prevent invalid state
      this.pendingQueenSelection = undefined;
      // Force end turn
      this.endTurn(currentPlayer);
      // Notify state change
      if (this.onStateChange) {
        this.onStateChange(this.getState());
      }
    }
  }

  public handleDebugCommand(command: DebugCommand) {
    switch (command.type) {
      case 'SET_GAME_STATUS':
        this.status = command.payload.status;
        if (this.status === GameStatus.FINISHED && !this.winnerId && this.players.length > 0) {
          this.winnerId = this.players[0].id;
          this.clearTurnTimer();
        }
        if (this.status === GameStatus.PLAYING && this.players.length >= 2 && this.deck.count === 52) {
          this.startGame();
        }
        break;
      case 'RESET_GAME':
        this.resetGame();
        break;
      case 'GIVE_CARD':
        this.giveDebugCard(command.payload.cardType);
        break;
      case 'SWITCH_TURN':
        if (this.players.length > 0) {
          this.endTurn(this.players[this.currentTurnIndex]);
        }
        break;
      case 'WAKE_ALL_QUEENS':
        this.wakeAllQueens();
        break;
      case 'SLEEP_ALL_QUEENS':
        this.sleepAllQueens();
        break;
    }
  }

  private resetGame() {
    this.clearTurnTimer();
    this.status = GameStatus.LOBBY;
    this.deck = new Deck();
    this.initializeQueens();
    this.discardPile = [];
    this.winnerId = undefined;
    this.lastAction = undefined;
    this.pendingQueenSelection = undefined;
    this.currentTurnIndex = 0;
    this.players.forEach(p => {
      p.hand = [];
      p.awokenQueens = [];
    });
  }

  private giveDebugCard(type: CardType) {
    const player = this.players[this.currentTurnIndex];
    if (!player) return;

    const newCard: Card = {
      id: uuidv4(),
      type: type,
      name: 'Debug ' + type,
      value: type === CardType.NUMBER ? 5 : undefined
    };
    player.addCard(newCard);
  }

  private wakeAllQueens() {
    const player = this.players[this.currentTurnIndex];
    if (!player) return;
    this.queens.forEach(q => {
      if (!q.isAwake) {
        // Bypassing constraints for debug
        player.wakeQueen(q);
      }
    });
  }

  private sleepAllQueens() {
    this.queens.forEach(q => {
      if (q.isAwake && q.ownerId) {
        const owner = this.players.find(p => p.id === q.ownerId);
        if (owner) {
          owner.looseQueen(q.id);
        }
        q.isAwake = false;
        q.ownerId = undefined;
      }
    });
  }

  private initializeQueens() {
    this.queens = QUEENS_DATA.map(q => ({
      ...q,
      id: uuidv4(),
      isAwake: false
    }));

    // Shuffle queens
    for (let i = this.queens.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queens[i], this.queens[j]] = [this.queens[j], this.queens[i]];
    }
  }

  public addPlayer(id: string, name: string, socketId: string): Player {
    if (this.status !== GameStatus.LOBBY && this.status !== GameStatus.PLAYING) {
      // ...
    }
    if (this.status !== GameStatus.LOBBY) {
      throw new Error('Game already started');
    }
    if (this.players.length >= 5) {
      throw new Error('Game is full');
    }

    // First player is host, or if hostId is missing
    if (this.players.length === 0 || !this.hostId) {
      this.hostId = id;
      console.log(`Host set to player ${id} (${name})`);
    }

    const player = new Player(id, name, socketId);
    this.players.push(player);
    return player;
  }

  public removePlayer(id: string) {
    this.players = this.players.filter(p => p.id !== id);

    // If host leaves, assign new host
    if (id === this.hostId && this.players.length > 0) {
      this.hostId = this.players[0].id;
      console.log(`Host left, new host is ${this.hostId}`);
    }

    if (this.status === GameStatus.PLAYING && this.players.length < 2) {
      this.resetGame();
    }
  }

  public disconnectPlayer(socketId: string) {
    const player = this.players.find(p => p.socketId === socketId);
    if (player) {
      player.isConnected = false;
    }
  }

  public playerReconnected(userId: string, socketId: string) {
    const player = this.players.find(p => p.id === userId);
    if (player) {
      player.isConnected = true;
      player.socketId = socketId;

      // Resume timer if it's this player's turn and timer is stopped
      const currentPlayer = this.players[this.currentTurnIndex];
      if (this.status === GameStatus.PLAYING &&
        !this.winnerId &&
        currentPlayer?.id === player.id &&
        !this.turnTimer) {
        this.startTurnTimer();
      }

      if (this.onStateChange) {
        this.onStateChange(this.getState());
      }
    }
  }

  public startGame() {
    if (this.players.length < 2) {
      throw new Error('Not enough players');
    }
    this.status = GameStatus.PLAYING;
    this.deck.shuffle();

    // Deal 5 cards to each player
    this.players.forEach(player => {
      for (let i = 0; i < 5; i++) {
        const card = this.deck.draw();
        if (card) player.addCard(card);
      }
    });

    // Randomize starting player? Or just 0?
    // For fairness, let's pick random start
    this.currentTurnIndex = Math.floor(Math.random() * this.players.length);

    // Start timer
    this.startTurnTimer();
  }

  public handleAction(action: GameAction) {
    const player = this.players.find(p => p.id === action.playerId);
    if (!player) throw new Error('Player not found');

    // Check if we are waiting for a queen selection
    const isQueenSelectionAction = this.pendingQueenSelection &&
      action.type === 'WAKE_QUEEN' &&
      this.pendingQueenSelection.playerId === player.id;

    if (this.pendingQueenSelection && !isQueenSelectionAction) {
      throw new Error('Waiting for queen selection');
    }

    const currentPlayer = this.players[this.currentTurnIndex];
    if (!isQueenSelectionAction) {
      if (!currentPlayer) throw new Error('Invalid turn state');
      if (player.id !== currentPlayer.id) {
        throw new Error('Not your turn');
      }
    }

    // Prepare enriched action for history (captured before execution modifies state)
    const enrichedAction = JSON.parse(JSON.stringify(action)); // Deep copy to be safe
    if (!enrichedAction.payload) enrichedAction.payload = {};

    if (enrichedAction.type === 'PLAY_CARD' && enrichedAction.payload.cardId) {
      const card = player.hand.find(c => c.id === enrichedAction.payload.cardId);
      if (card) {
        enrichedAction.payload.cardType = card.type;
        enrichedAction.payload.cardName = card.name;
      }
      if (enrichedAction.payload.targetQueenId) {
        const queen = this.queens.find(q => q.id === enrichedAction.payload.targetQueenId);
        if (queen) enrichedAction.payload.targetQueenName = queen.name;
      }
      if (enrichedAction.payload.targetPlayerId) {
        const target = this.players.find(p => p.id === enrichedAction.payload.targetPlayerId);
        if (target) enrichedAction.payload.targetPlayerName = target.name;
      }
    } else if (enrichedAction.type === 'DISCARD' && enrichedAction.payload.cardIds) {
      enrichedAction.payload.count = enrichedAction.payload.cardIds.length;
    } else if (enrichedAction.type === 'WAKE_QUEEN' && enrichedAction.payload.targetQueenId) {
      const queen = this.queens.find(q => q.id === enrichedAction.payload.targetQueenId);
      if (queen) enrichedAction.payload.targetQueenName = queen.name;
    }

    switch (action.type) {
      case 'PLAY_CARD':
        this.resolvePlayCard(player, action.payload);
        break;
      case 'DISCARD': // Used for number cards usually
        this.resolveDiscard(player, action.payload);
        break;
      case 'WAKE_QUEEN':
        this.resolveWakeQueen(player, action.payload);
        break;
      // Attack/Defend specific actions could be handled within PLAY_CARD or separately
      // For simplicity, we'll handle logic inside resolvePlayCard
    }

    // Only set lastAction if the action succeeded (didn't throw)
    this.lastAction = enrichedAction;

    this.checkWinCondition();
  }

  private resolvePlayCard(player: Player, payload: any) {
    // Payload expected: { cardId: string, targetPlayerId?: string, targetQueenId?: string, discardCardIds?: string[] }
    const { cardId, targetPlayerId, targetQueenId } = payload;
    const card = player.hand.find(c => c.id === cardId);

    if (!card) throw new Error('Card not in hand');

    let shouldEndTurn = true;

    // Process Card Effect
    switch (card.type) {
      case CardType.KING:
        this.playKing(player, card, targetQueenId);
        break;
      case CardType.KNIGHT:
        this.playKnight(player, card, targetPlayerId, targetQueenId);
        break;
      case CardType.POTION:
        this.playPotion(player, card, targetPlayerId, targetQueenId);
        break;
      case CardType.JESTER:
        shouldEndTurn = this.playJester(player, card);
        break;
      case CardType.NUMBER:
        // Usually numbers are just discarded to draw new ones
        throw new Error('Use DISCARD action for numbers');
      default:
        // Wands and Dragons are reaction cards, not played proactively usually
        // But if someone tries to play them?
        throw new Error('Cannot play this card directly');
    }

    // End turn logic (draw back to 5)
    // Only end turn if we are NOT waiting for selection (Jester might trigger it)
    if (shouldEndTurn && !this.pendingQueenSelection) {
      this.endTurn(player);
    }
  }

  private addPendingPick(playerId: string, count: number) {
    // Reset timer when pending pick occurs? 
    // Or maybe keep the same timer?
    // If Jester reveals number, player has to pick. Should we restart timer for the PICKER?
    // The requirement is "turn is lost and moves to next player" if time passes.
    // If waiting for pick, the turn is technically on the picker.

    // If pending selection changes the active player (Jester number card), we should restart timer for that player.
    // Logic in playJester handles waiting.
    // When pending selection is set, we should restart timer if the player changed.

    if (this.pendingQueenSelection && this.pendingQueenSelection.playerId === playerId) {
      this.pendingQueenSelection.picksRemaining = (this.pendingQueenSelection.picksRemaining || 0) + count;
    } else {
      this.pendingQueenSelection = { playerId, picksRemaining: count };
      // Restart timer for the player who now has to pick
      this.startTurnTimer();
    }
  }

  private handleQueenWakeEffects(player: Player, queen: Queen) {
    // Check Dog/Cat Constraint BEFORE actually adding to hand
    // If blocked, the queen is not woken up, but the turn is consumed.
    const hasCat = player.hasQueen('Cat Queen');
    const hasDog = player.hasQueen('Dog Queen');
    const isCat = queen.name.includes('Cat');
    const isDog = queen.name.includes('Dog');

    if ((isCat && hasDog) || (isDog && hasCat)) {
      // Blocked logic: Queen stays where it is (sleeping)
      // Turn ends
      // We might want to signal this failure via an event or just not update the queen
      queen.isAwake = false;
      queen.ownerId = undefined;
      return;
    }

    // Proceed with wake
    player.wakeQueen(queen);

    // Handle Rose Queen ability (wake another)
    if (queen.name === 'Rose Queen') {
      const anySleeping = this.queens.some(q => !q.isAwake && q.id !== queen.id);
      if (anySleeping) {
        this.addPendingPick(player.id, 1);
      }
    }
  }

  private playKing(player: Player, card: Card, targetQueenId?: string) {
    if (!targetQueenId) {
      throw new Error('Must select a queen');
    }

    const queen = this.queens.find(q => q.id === targetQueenId && !q.isAwake);
    if (!queen) throw new Error('Queen not available');

    this.discardCard(player, card.id);

    // Handle Tie-Dye King (wake 2 queens)
    if (card.name === 'tie-dye') {
      const anyOtherSleeping = this.queens.some(q => !q.isAwake && q.id !== queen.id);
      if (anyOtherSleeping) {
        this.addPendingPick(player.id, 1);
      }
    } else {
      // Only for debugging: log if card name is mismatched
      console.log(`Playing King: ${card.name}`);
    }

    this.handleQueenWakeEffects(player, queen);
  }

  private playKnight(player: Player, card: Card, targetPlayerId?: string, targetQueenId?: string) {
    if (!targetPlayerId || !targetQueenId) throw new Error('Target required');
    const targetPlayer = this.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) throw new Error('Target player not found');

    if (!targetPlayer.hasQueen(this.queens.find(q => q.id === targetQueenId)?.name || '')) {
      throw new Error('Target player does not have that queen');
    }

    const targetQueen = this.queens.find(q => q.id === targetQueenId);
    if (targetQueen?.name === 'Strawberry Queen') {
      throw new Error('Strawberry Queen cannot be stolen');
    }

    this.discardCard(player, card.id);

    // Check for Dragon
    const dragonCard = targetPlayer.hand.find(c => c.type === CardType.DRAGON);
    if (dragonCard) {
      // Blocked!
      this.discardCard(targetPlayer, dragonCard.id);
      this.drawCard(targetPlayer); // Defender refills hand immediately? Rules say yes.
      return; // Action failed
    }

    // Steal Queen Logic
    // Check Dog/Cat Conflict for Stealing
    const queenToSteal = this.queens.find(q => q.id === targetQueenId);
    if (!queenToSteal) return; // Should have been caught above

    const hasCat = player.hasQueen('Cat Queen');
    const hasDog = player.hasQueen('Dog Queen');
    const isCat = queenToSteal.name.includes('Cat');
    const isDog = queenToSteal.name.includes('Dog');

    if ((isCat && hasDog) || (isDog && hasCat)) {
      // Conflict! Attack succeeds (Knight discarded, Dragon not used), but Queen stays with OWNER.
      // Effectively the attack is wasted.
      // OR does it go back to sleep? Rules say "you cannot hold both". Usually means you can't take it.
      // We'll say attack fails to take the card.
      return;
    }

    // Success
    const queen = targetPlayer.looseQueen(targetQueenId);
    if (queen) {
      player.wakeQueen(queen);
    }
  }

  private playPotion(player: Player, card: Card, targetPlayerId?: string, targetQueenId?: string) {
    if (!targetPlayerId || !targetQueenId) throw new Error('Target required');
    const targetPlayer = this.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) throw new Error('Target player not found');

    const queen = this.queens.find(q => q.id === targetQueenId);
    if (!queen || !targetPlayer.hasQueen(queen.name)) throw new Error('Target does not have queen');

    if (queen.name === 'Strawberry Queen') {
      throw new Error('Strawberry Queen cannot be put to sleep');
    }

    this.discardCard(player, card.id);

    // Check for Wand
    const wandCard = targetPlayer.hand.find(c => c.type === CardType.WAND);
    if (wandCard) {
      // Blocked!
      this.discardCard(targetPlayer, wandCard.id);
      this.drawCard(targetPlayer);
      return;
    }

    // Sleep Queen
    const lostQueen = targetPlayer.looseQueen(targetQueenId);
    if (lostQueen) {
      lostQueen.isAwake = false;
      lostQueen.ownerId = undefined;
      // Return to center (should be logically handled by just removing ownerId and isAwake=false)
    }
  }

  private playJester(player: Player, card: Card): boolean {
    this.discardCard(player, card.id);

    while (true) {
      const revealedCard = this.deck.draw();
      if (!revealedCard) {
        this.reshuffleDiscard();
        if (this.deck.count === 0) return true;
        continue;
      }

      // Reveal logic would emit event usually. Here we just process result.

      if (revealedCard.type !== CardType.NUMBER) {
        player.addCard(revealedCard);
        // No turn end.
        return false;
      } else {
        this.discardPile.push(revealedCard);
        // Number card
        const count = revealedCard.value || 0;
        // Count around the table
        const targetIndex = (this.currentTurnIndex + (count - 1)) % this.players.length;

        const targetPlayer = this.players[targetIndex];
        if (!targetPlayer) return true; // Should not happen

        // Set state to waiting for queen selection
        // This calls addPendingPick which restarts timer for targetPlayer
        this.addPendingPick(targetPlayer.id, 1);
        return true;
      }
    }
  }

  private resolveWakeQueen(player: Player, payload: any) {
    if (!this.pendingQueenSelection) throw new Error('No pending queen selection');
    if (this.pendingQueenSelection.playerId !== player.id) throw new Error('Not your turn to pick a queen');

    const { targetQueenId } = payload;
    if (!targetQueenId) throw new Error('Must select a queen');

    const queen = this.queens.find(q => q.id === targetQueenId && !q.isAwake);
    if (!queen) throw new Error('Queen not available');

    // Decrement picks
    if (this.pendingQueenSelection.picksRemaining && this.pendingQueenSelection.picksRemaining > 0) {
      this.pendingQueenSelection.picksRemaining--;
    }

    // Use shared logic
    this.handleQueenWakeEffects(player, queen);

    // Check if done
    if (!this.pendingQueenSelection || !this.pendingQueenSelection.picksRemaining || this.pendingQueenSelection.picksRemaining <= 0) {
      this.pendingQueenSelection = undefined;
      // End turn of the ORIGINAL player.
      const originalPlayer = this.players[this.currentTurnIndex];
      this.endTurn(originalPlayer);
    }
  }

  private resolveDiscard(player: Player, payload: any) {
    // Payload: { cardIds: string[] }
    const { cardIds } = payload;
    console.log("Resolving discard for", player.name, cardIds);
    if (!Array.isArray(cardIds) || cardIds.length === 0) throw new Error('No cards selected');

    // Validate cards exist
    const cards = cardIds.map(id => player.hand.find(c => c.id === id));
    if (cards.some(c => !c)) throw new Error('Cards not in hand');

    // Basic validation:
    const numbers = (cards as Card[]).map(c => c.value || 0).sort((a, b) => a - b);
    console.log("Discard numbers:", numbers);
    let isValid = false;

    if (cards.length === 1) isValid = true;
    else {
      // Check if cards can be partitioned into two sets with equal sums
      // This supports:
      // 1. Pairs: 5, 5 -> 5=5 (Sum=10, target=5)
      // 2. Simple addition: 2, 3, 5 -> 2+3=5 (Sum=10, target=5)
      // 3. Complex equations: 3, 4, 5, 6 -> 3+6=4+5 (Sum=18, target=9)
      const sum = numbers.reduce((a, b) => a + b, 0);
      if (sum % 2 === 0) {
        const target = sum / 2;
        isValid = this.canSubsetSum(numbers, target);
      }
    }

    if (!isValid) throw new Error('Invalid discard combination');

    // Discard and Draw
    cardIds.forEach(id => this.discardCard(player, id));

    // Draw back up to 5? 
    // Rule: Draw equal number of cards discarded.
    for (let i = 0; i < cardIds.length; i++) {
      this.drawCard(player);
    }

    this.endTurn(player);
  }

  private canSubsetSum(numbers: number[], target: number): boolean {
    // Simple subset sum implementation using dynamic programming
    const possibleSums = new Set<number>([0]);

    for (const num of numbers) {
      const newSums = new Array<number>();
      for (const sum of possibleSums) {
        const currentSum = sum + num;
        if (currentSum === target) return true;
        if (currentSum < target) newSums.push(currentSum);
      }
      newSums.forEach(s => possibleSums.add(s));
    }

    return possibleSums.has(target);
  }

  private discardCard(player: Player, cardId: string) {
    const card = player.removeCard(cardId);
    if (card) this.discardPile.push(card);
  }

  private drawCard(player: Player) {
    if (this.deck.count === 0) this.reshuffleDiscard();
    const card = this.deck.draw();
    if (card) player.addCard(card);
  }

  private reshuffleDiscard() {
    if (this.discardPile.length === 0) return;
    console.log("Deck empty, reshuffling discard pile");
    this.deck.recycle(this.discardPile);
    this.discardPile = [];
  }

  private endTurn(player: Player) {
    this.clearTurnTimer();

    // Draw up to 5 cards if hand is low
    while (player.hand.length < 5) {
      this.drawCard(player);
      if (this.deck.count === 0 && this.discardPile.length === 0) break;
    }

    if (this.players.length === 0) return;

    // Skip disconnected players
    let attempts = 0;
    do {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
      attempts++;
    } while (this.players[this.currentTurnIndex] && !this.players[this.currentTurnIndex].isConnected && attempts < this.players.length);

    // Start next turn timer
    const nextPlayer = this.players[this.currentTurnIndex];
    if (this.status === GameStatus.PLAYING && !this.winnerId && nextPlayer?.isConnected) {
      this.startTurnTimer();
    }
  }

  private checkWinCondition() {
    const playerCount = this.players.length;
    const pointsToWin = playerCount >= 4 ? 40 : 50;
    const queensToWin = playerCount >= 4 ? 4 : 5;

    const winner = this.players.find(p =>
      p.score >= pointsToWin || p.awokenQueens.length >= queensToWin
    );

    if (winner) {
      this.status = GameStatus.FINISHED;
      this.winnerId = winner.id;
      this.clearTurnTimer();
    } else if (this.queens.every(q => q.isAwake)) {
      const sorted = [...this.players].sort((a, b) => b.score - a.score);
      this.status = GameStatus.FINISHED;
      this.winnerId = sorted[0].id;
      this.clearTurnTimer();
    }
  }

  public getState(): GameState {
    return {
      roomId: this.id,
      status: this.status,
      hostId: this.hostId,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        hand: p.hand,
        awokenQueens: p.awokenQueens,
        score: p.score,
        isConnected: p.isConnected
      })),
      currentTurnPlayerId: this.players[this.currentTurnIndex]?.id,
      queens: this.queens,
      drawPileCount: this.deck.count,
      discardPile: this.discardPile, // Maybe only top card?
      lastAction: this.lastAction,
      winnerId: this.winnerId,
      pendingQueenSelection: this.pendingQueenSelection,
      turnDeadline: this.turnDeadline, // Add to state
      turnTimeLimit: this.turnDurationMs / 1000 // Added to state
    };
  }
}
