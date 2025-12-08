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
  const levels: BidLevel[] = [1, 2, 3, 4, 5]; 
  const suits: BidSuit[] = ['C', 'D', 'H', 'S', 'NT'];

  if (!isMyTurn) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-pulse">
        <div className="text-xl font-bold text-yellow-400 bg-black/50 px-4 py-2 rounded-full">
          Opponent is Bidding...
        </div>
      </div>
    );
  }

  return (
    // 👉 关键修改：scale-50 缩小到50%，max-w 也相应调小
    <div className="flex flex-col items-center justify-center h-full w-full max-w-xl mx-auto px-2 relative z-50 scale-50 origin-center">
      <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg w-full flex flex-col gap-2">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-gray-700 text-sm">Your Bid:</span>
        </div>
        
        <div className="flex flex-col gap-1">
          {levels.map(level => (
            <div key={level} className="flex gap-1 items-center justify-center">
              <span className="font-bold text-gray-500 w-4 text-center">{level}</span>
              {suits.map(suit => {
                const potentialBid: Bid = { level, suit, bidder: myId };
                const valid = isValidBid(currentBid, potentialBid);
                
                const isRed = suit === 'H' || suit === 'D';
                const isNT = suit === 'NT';
                
                return (
                  <button
                    key={`${level}${suit}`}
                    disabled={!valid}
                    onClick={() => onBid(potentialBid)}
                    className={`
                      h-9 flex-1 rounded font-bold text-base flex items-center justify-center
                      ${valid 
                        ? 'bg-white border border-gray-300 active:bg-blue-100' 
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
          className="mt-1 w-full bg-red-600 text-white py-2 rounded-lg font-bold text-base active:bg-red-800"
        >
          PASS
        </button>
      </div>
    </div>
  );
};