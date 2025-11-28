import { Player as IPlayer, Card, Queen } from '@sq/shared';

export class Player implements IPlayer {
  public id: string;
  public name: string;
  public socketId: string;
  public hand: Card[] = [];
  public awokenQueens: Queen[] = [];
  public isConnected: boolean = true;

  constructor(id: string, name: string, socketId: string) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
  }

  public get score(): number {
    return this.awokenQueens.reduce((sum, q) => sum + q.points, 0);
  }

  public addCard(card: Card) {
    this.hand.push(card);
  }

  public removeCard(cardId: string): Card | undefined {
    const index = this.hand.findIndex(c => c.id === cardId);
    if (index !== -1) {
      return this.hand.splice(index, 1)[0];
    }
    return undefined;
  }

  public wakeQueen(queen: Queen) {
    queen.isAwake = true;
    queen.ownerId = this.id;
    this.awokenQueens.push(queen);
  }

  public looseQueen(queenId: string): Queen | undefined {
    const index = this.awokenQueens.findIndex(q => q.id === queenId);
    if (index !== -1) {
      const queen = this.awokenQueens.splice(index, 1)[0];
      queen.ownerId = undefined;
      // Note: isAwake status depends on where it goes (back to sleep or to another player)
      return queen;
    }
    return undefined;
  }

  public hasQueen(queenName: string): boolean {
    return this.awokenQueens.some(q => q.name === queenName);
  }
}

