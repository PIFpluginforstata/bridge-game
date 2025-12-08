import { Card, Suit, Rank, GameState, PlayerId, Bid, BidSuit } from '../types';
import { SUITS, RANKS, RANK_VALUES, BID_SUIT_ORDER, SUIT_SYMBOLS } from '../constants';

export const generateDeck = (): Card[] => {
  const deck: Card[] = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        value: RANK_VALUES[rank],
      });
    });
  });
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

// Sorts by Suit (S, H, D, C) then Rank (A -> 2)
export const sortHand = (hand: Card[]): Card[] => {
  const suitOrder = { 'S': 0, 'H': 1, 'D': 2, 'C': 3 };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return b.value - a.value;
  });
};

export const isValidBid = (currentBid: Bid | null, newBid: Bid): boolean => {
  if (!currentBid) return true;
  if (newBid.level > currentBid.level) return true;
  if (newBid.level < currentBid.level) return false;
  return BID_SUIT_ORDER[newBid.suit] > BID_SUIT_ORDER[currentBid.suit];
};

export const canPlayCard = (
  card: Card,
  hand: Card[],
  gameState: GameState,
  playerId: PlayerId
): { valid: boolean; reason?: string } => {
  const { currentTrick, trump, trumpBroken } = gameState;

  // 1. If leading the trick
  if (currentTrick.cards.length === 0) {
    // Rule: Cannot lead Trump unless broken or NT, or only trumps in hand.
    if (trump && trump !== 'NT' && card.suit === trump) {
      if (trumpBroken) return { valid: true };
      
      const hasNonTrump = hand.some(c => c.suit !== trump);
      if (!hasNonTrump) return { valid: true }; // Only trumps left
      
      return { valid: false, reason: "Cannot lead trump until broken." };
    }
    return { valid: true };
  }

  // 2. If following
  const leadCard = currentTrick.cards[0].card;
  const leadSuit = leadCard.suit;

  // Must follow suit if possible
  if (card.suit === leadSuit) return { valid: true };

  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  if (hasLeadSuit) {
    return { valid: false, reason: `Must follow suit (${SUIT_SYMBOLS[leadSuit] || leadSuit})` };
  }

  // Can play anything (slough or ruff)
  return { valid: true };
};

export const determineTrickWinner = (cards: { player: PlayerId; card: Card }[], trump: BidSuit | null): PlayerId => {
  if (cards.length !== 2) throw new Error("Trick must have 2 cards");

  const lead = cards[0];
  const follow = cards[1];

  // If follow plays trump and lead didn't
  if (trump && trump !== 'NT' && follow.card.suit === trump && lead.card.suit !== trump) {
    return follow.player;
  }

  // If lead plays trump and follow doesn't
  if (trump && trump !== 'NT' && lead.card.suit === trump && follow.card.suit !== trump) {
    return lead.player;
  }

  // If same suit (or both trump, or both non-trump same suit), higher rank wins
  if (lead.card.suit === follow.card.suit) {
    return lead.card.value > follow.card.value ? lead.player : follow.player;
  }

  // If different suits and no trump involved (or trump is NT), lead wins
  return lead.player;
};