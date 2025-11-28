import { Card, CardType, Queen } from '@sq/shared';
import { v4 as uuidv4 } from 'uuid';

export const QUEENS_DATA: Omit<Queen, 'id' | 'isAwake'>[] = [
  { name: 'Book Queen', points: 15 },
  { name: 'Butterfly Queen', points: 10 },
  { name: 'Cake Queen', points: 5 },
  { name: 'Cat Queen', points: 15 },
  { name: 'Dog Queen', points: 15 },
  { name: 'Heart Queen', points: 20 },
  { name: 'Ice Cream Queen', points: 5 },
  { name: 'Ladybug Queen', points: 10 },
  { name: 'Sunflower Queen', points: 10 },
  { name: 'Moon Queen', points: 10 },
  { name: 'Pancake Queen', points: 15 },
  { name: 'Peacock Queen', points: 10 },
  { name: 'Rainbow Queen', points: 5 },
  { name: 'Rose Queen', points: 5 },
  { name: 'Starfish Queen', points: 5 },
  { name: 'Strawberry Queen', points: 10 },
];

export class Deck {
  private cards: Card[] = [];

  constructor() {
    this.initializeDeck();
    this.shuffle();
  }

  private initializeDeck() {
    // 8 Kings
    const kings = [
      'bubble-gum',
      'chess',
      'cookie',
      'fire',
      'hat',
      'pasta',
      'puzzle',
      'tie-dye'
    ];
    kings.forEach(king => {
      this.addCard(CardType.KING, king);
    });

    // 4 Knights
    const knights = [
      'black',
      'blue',
      'green',
      'red'
    ];
    knights.forEach(knight => {
      this.addCard(CardType.KNIGHT, knight);
    });
    // 3 Dragons
    for (let i = 0; i < 3; i++) {
      this.addCard(CardType.DRAGON, `Dragon ${i + 1}`);
    }
    // 4 Sleeping Potions
    for (let i = 0; i < 4; i++) {
      this.addCard(CardType.POTION, `Sleeping Potion ${i + 1}`);
    }
    // 3 Wands
    for (let i = 0; i < 3; i++) {
      this.addCard(CardType.WAND, `Wand ${i + 1}`);
    }
    // 5 Jesters
    for (let i = 0; i < 5; i++) {
      this.addCard(CardType.JESTER, `Jester ${i + 1}`);
    }
    // 4 of each number 1-10
    for (let num = 1; num <= 10; num++) {
      for (let i = 0; i < 4; i++) {
        this.addCard(CardType.NUMBER, `${num}`, num);
      }
    }
  }

  private addCard(type: CardType, name: string, value?: number) {
    this.cards.push({
      id: uuidv4(),
      type,
      name,
      value
    });
  }

  public shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  public draw(): Card | undefined {
    return this.cards.pop();
  }

  public get count(): number {
    return this.cards.length;
  }
  
  public recycle(cards: Card[]) {
      this.cards.push(...cards);
      this.shuffle();
  }
}
