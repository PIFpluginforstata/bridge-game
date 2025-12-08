import React from 'react';
import { Card as CardType } from '../types';
import { SUIT_SYMBOLS } from '../constants';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  playable?: boolean;
  hidden?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, onClick, selected, disabled, playable, hidden }) => {
  if (hidden) {
    return (
      <div className="w-12 h-16 md:w-16 md:h-24 bg-blue-900 rounded border border-white shadow-sm flex items-center justify-center relative">
        <div className="w-full h-full border-2 border-blue-800 rounded opacity-50"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
      </div>
    );
  }

  // Explicitly check for red suits
  const isRed = card.suit === 'H' || card.suit === 'D';
  // Standard Tailwind Text Colors
  const colorClass = isRed ? 'text-red-600' : 'text-black';

  return (
    <motion.div
      whileHover={playable && !disabled ? { y: -10 } : {}}
      animate={selected ? { y: -10 } : { y: 0 }}
      onClick={() => !disabled && onClick?.()}
      className={clsx(
        "w-12 h-16 md:w-16 md:h-24 bg-white rounded shadow-md border border-gray-300 relative select-none",
        // CRITICAL: No grayscale or opacity-50 here.
        // Disabled only affects the cursor.
        !disabled ? "cursor-pointer" : "cursor-default",
        playable && !disabled && "ring-2 ring-yellow-400 ring-offset-1"
      )}
    >
      {/* Top Left */}
      <div className={clsx("absolute top-0.5 left-0.5 font-bold text-[10px] leading-none flex flex-col items-center", colorClass)}>
        <div>{card.rank}</div>
        <div>{SUIT_SYMBOLS[card.suit]}</div>
      </div>
      
      {/* Bottom Right (Rotated) */}
      <div className={clsx("absolute bottom-0.5 right-0.5 font-bold text-[10px] leading-none rotate-180 flex flex-col items-center", colorClass)}>
        <div>{card.rank}</div>
        <div>{SUIT_SYMBOLS[card.suit]}</div>
      </div>

      {/* Center Big Symbol */}
      <div className={clsx("absolute inset-0 flex items-center justify-center text-3xl", colorClass)}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
    </motion.div>
  );
};