export type Suit = 'C' | 'D' | 'H' | 'S';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type PlayerId = 'host' | 'peer';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

export type BidLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type BidSuit = 'C' | 'D' | 'H' | 'S' | 'NT';

export interface Bid {
  level: BidLevel;
  suit: BidSuit;
  bidder: PlayerId;
}

export type GamePhase = 'LOBBY' | 'BIDDING' | 'PLAYING' | 'GAME_OVER';

export interface GameState {
  phase: GamePhase;
  hands: {
    host: Card[];
    peer: Card[];
  };
  dealer: PlayerId;
  turn: PlayerId;
  currentBid: Bid | null;
  passCount: number;
  declarer: PlayerId | null;
  trump: BidSuit | null;
  contractTarget: number;
  tricks: {
    host: number;
    peer: number;
  };
  // Track specific cards won by each player for visual history
  wonCards: {
    host: Card[];
    peer: Card[];
  };
  currentTrick: {
    leader: PlayerId;
    cards: { player: PlayerId; card: Card }[];
  };
  trumpBroken: boolean;
  readyForNext: {
    host: boolean;
    peer: boolean;
  };
  lastWinner: PlayerId | null;
}

export interface PlayerAction {
  type: 'BID' | 'PASS' | 'PLAY_CARD' | 'READY_NEXT' | 'SYNC_REQUEST';
  payload?: {
    bid?: Bid;
    cardId?: string;
  };
}