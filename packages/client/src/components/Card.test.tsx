import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';
import { CardType } from '@sq/shared';
import { vi } from 'vitest';

// Mock translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue || key,
  }),
}));

// Mock card images util to avoid loading images
vi.mock('../utils/cardImages', () => ({
  getCardImageUrl: () => null,
  getBackImageUrl: () => null,
}));

describe('Card Component', () => {
  const mockOnClick = vi.fn();

  test('renders face down card', () => {
    render(<Card faceDown onClick={mockOnClick} />);
    const cardElement = screen.getByText('SQ');
    expect(cardElement).toBeInTheDocument();
    expect(cardElement).toHaveClass('card-back');
    
    fireEvent.click(cardElement);
    expect(mockOnClick).toHaveBeenCalled();
  });

  test('renders number card', () => {
    const card = { id: '1', type: CardType.NUMBER, value: 5, name: '5' };
    render(<Card card={card} onClick={mockOnClick} />);
    
    // Use getAllByText because the number appears in both content and name
    const elements = screen.getAllByText('5');
    expect(elements).toHaveLength(2);
    expect(elements[0]).toBeInTheDocument();
  });

  test('renders King card', () => {
    const card = { id: 'k1', type: CardType.KING, name: 'King' };
    render(<Card card={card} />);
    
    expect(screen.getByText('♔')).toBeInTheDocument();
    expect(screen.getByText('King')).toBeInTheDocument();
  });

  test('applies selected class', () => {
    render(<Card faceDown selected />);
    const cardElement = screen.getByText('SQ');
    expect(cardElement).toHaveClass('selected');
  });

  test('applies custom className', () => {
    render(<Card faceDown className="custom-class" />);
    const cardElement = screen.getByText('SQ');
    expect(cardElement).toHaveClass('custom-class');
  });
});


