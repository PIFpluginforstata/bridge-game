import React from 'react';
import { Bid, BidLevel, BidSuit, PlayerId } from '../types';
import { SUIT_SYMBOLS } from '../constants';
import { isValidBid } from '../utils/gameLogic';

interface BiddingPanelProps {
  currentBid: Bid | null;
  myId: PlayerId;
  turn: PlayerId;
  onBid: (bid: Bid) => void;
  onPass: () => void;
}

export const BiddingPanel: React.FC<BiddingPanelProps> = ({ currentBid, myId, turn, onBid, onPass }) => {
  const isMyTurn = myId === turn;
  const levels: BidLevel[] = [1, 2, 3, 4, 5]; // Removed 6 and 7
  const suits: BidSuit[] = ['C', 'D', 'H', 'S', 'NT'];

  if (!isMyTurn) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-pulse">
        <div className="text-2xl font-bold text-yellow-400 bg-black/50 px-6 py-2 rounded-full">
          Opponent is Bidding...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-4xl mx-auto px-4 relative z-50">
      <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg w-full flex flex-col gap-2">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-gray-700">Your Bid:</span>
        </div>
        
        <div className="flex flex-col gap-2">
          {levels.map(level => (
            <div key={level} className="flex gap-2 items-center justify-center">
              <span className="font-bold text-gray-500 w-4">{level}</span>
              {suits.map(suit => {
                const potentialBid: Bid = { level, suit, bidder: myId };
                const valid = isValidBid(currentBid, potentialBid);
                
                // Force Red Color explicitly
                const isRed = suit === 'H' || suit === 'D';
                const isNT = suit === 'NT';
                
                return (
                  <button
                    key={`${level}${suit}`}
                    disabled={!valid}
                    onClick={() => onBid(potentialBid)}
                    className={`
                      h-10 flex-1 rounded font-bold text-lg flex items-center justify-center transition-all
                      ${valid 
                        ? 'bg-white border border-gray-300 hover:bg-blue-50 hover:border-blue-500 shadow-sm hover:-translate-y-0.5' 
                        : 'bg-gray-100 text-gray-300 border border-transparent cursor-not-allowed'}
                      ${valid && isRed ? 'text-red-600' : ''}
                      ${valid && !isRed && !isNT ? 'text-black' : ''}
                      ${valid && isNT ? 'text-blue-800' : ''}
                    `}
                  >
                    {suit === 'NT' ? 'NT' : SUIT_SYMBOLS[suit]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <button
          onClick={onPass}
          className="mt-2 w-full bg-red-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-red-700 shadow active:scale-[0.99] transition-transform"
        >
          PASS
        </button>
      </div>
    </div>
  );
};