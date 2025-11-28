import React from 'react';
import { Card as ICard, CardType } from '@sq/shared';
import { useTranslation } from 'react-i18next';
import { getCardImageUrl, getBackImageUrl } from '../utils/cardImages';

interface CardProps {
  card?: ICard; // Optional for card back
  onClick?: () => void;
  selected?: boolean;
  faceDown?: boolean;
  backImage?: string;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ card, onClick, selected, faceDown, backImage, className }) => {
  const { t } = useTranslation();

  if (faceDown || !card) {
    const backUrl = backImage || getBackImageUrl();
    return (
      <div 
        className={`card card-back ${selected ? 'selected' : ''} ${className || ''}`} 
        onClick={onClick}
        style={backUrl ? { backgroundImage: `url(${backUrl})`, backgroundSize: 'cover' } : {}}
      >
        {!backUrl && 'SQ'}
      </div>
    );
  }

  const imageUrl = getCardImageUrl(card);

  const getCardContent = () => {
    switch (card.type) {
      case CardType.NUMBER:
        return <span className="number">{card.value}</span>;
      case CardType.KING:
        return '♔';
      case CardType.KNIGHT:
        return '♞';
      case CardType.DRAGON:
        return '🐉';
      case CardType.POTION:
        return '🧪';
      case CardType.WAND:
        return '🪄';
      case CardType.JESTER:
        return '🤡';
      default:
        return '?';
    }
  };

  const getCardName = () => {
    if (card.type === CardType.NUMBER) {
       return card.value?.toString() || '';
    }
    // If we have a specific name (like 'tie-dye'), try to prettify it or translate it
    if (card.name && card.name !== card.type) {
        // If translation exists, use it, otherwise format the name
        // e.g. 'tie-dye' -> 'Tie Dye'
        return t(`cards.names.${card.name}`, { defaultValue: card.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) });
    }
    return t(`cards.${card.type}`, { defaultValue: card.name || card.type });
  };

  return (
    <div 
      className={`card type-${card.type.toLowerCase()} ${selected ? 'selected' : ''} ${imageUrl ? 'has-image' : ''} ${className || ''}`}
      onClick={onClick}
      style={imageUrl ? { 
        backgroundImage: `url(${imageUrl})`, 
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'transparent'
      } : {}}
    >
      {!imageUrl && (
        <>
          <div className="card-top">{getCardContent()}</div>
          <div className="card-name">{getCardName()}</div>
        </>
      )}
    </div>
  );
};

