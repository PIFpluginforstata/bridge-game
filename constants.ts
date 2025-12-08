import { Rank, Suit } from './types';

export const SUITS: Suit[] = ['C', 'D', 'H', 'S'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  C: '♣',
  D: '♦',
  H: '♥',
  S: '♠',
};

// USING STANDARD TAILWIND CLASSES to ensure they load
export const SUIT_COLORS: Record<Suit, string> = {
  C: 'text-black',
  D: 'text-red-600',
  H: 'text-red-600',
  S: 'text-black',
};

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export const BID_SUIT_ORDER: Record<string, number> = {
  'C': 0, 'D': 1, 'H': 2, 'S': 3, 'NT': 4
};

export const BASE_TRICK_TARGET = 9; 
export const TOTAL_TRICKS = 19;