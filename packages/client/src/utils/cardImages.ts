import { Card, CardType } from '@sq/shared';

// Glob imports
const kingGlobs = import.meta.glob('../assets/kings/*.jpg', { eager: true, as: 'url' });
const knightGlobs = import.meta.glob('../assets/knights/*.jpg', { eager: true, as: 'url' });
const numberGlobs = import.meta.glob('../assets/numbers/*.jpg', { eager: true, as: 'url' });
const otherGlobs = import.meta.glob('../assets/others/*.jpg', { eager: true, as: 'url' });

// Helper to get filename from path
const getFileName = (path: string) => path.split('/').pop()?.split('.')[0] || '';

// Create maps
const kingMap: Record<string, string> = {};
Object.entries(kingGlobs).forEach(([path, url]) => {
  kingMap[getFileName(path)] = url;
});

const knightMap: Record<string, string> = {};
Object.entries(knightGlobs).forEach(([path, url]) => {
  knightMap[getFileName(path)] = url;
});

const numberMap: Record<string, string> = {};
Object.entries(numberGlobs).forEach(([path, url]) => {
  numberMap[getFileName(path)] = url;
});

const otherMap: Record<string, string> = {};
Object.entries(otherGlobs).forEach(([path, url]) => {
  otherMap[getFileName(path)] = url;
});

export const getCardImageUrl = (card: Card): string | undefined => {
  if (!card) return undefined;
  
  switch (card.type) {
    case CardType.KING:
      // card.name is expected to be the key (e.g., "tie-dye")
      return kingMap[card.name?.toLowerCase() || ''];
    case CardType.KNIGHT:
      return knightMap[card.name?.toLowerCase() || ''];
    case CardType.NUMBER:
      return numberMap[card.value?.toString() || ''];
    case CardType.DRAGON:
      return otherMap['dragon'];
    case CardType.POTION:
      return otherMap['potion'];
    case CardType.WAND:
      return otherMap['wand'];
    case CardType.JESTER:
      return otherMap['jester'];
    default:
      return undefined;
  }
};

export const getBackImageUrl = () => otherMap['back'];
export const getQueenBackImageUrl = () => otherMap['queen-back'];

