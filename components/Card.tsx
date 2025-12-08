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
      // 修改点：手机端 w-14 h-20 (56px x 80px)，电脑端保持 w-24 h-36
      <div className="w-14 h-20 md:w-24 md:h-36 bg-blue-900 rounded-lg border-2 border-white shadow-md flex items-center justify-center relative">
        <div className="w-full h-full border-4 border-blue-800 rounded-lg opacity-50"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
      </div>
    );
  }

  // Explicitly check for red suits
  const isRed = card.suit === 'H' || card.suit === 'D';
  const colorClass = isRed ? 'text-red-600' : 'text-black';

  return (
    <motion.div
      whileHover={playable && !disabled ? { y: -20 } : {}}
      animate={selected ? { y: -20 } : { y: 0 }}
      onClick={() => !disabled && onClick?.()}
      className={clsx(
        // 修改点：手机端 w-14 h-20，电脑端 w-24 h-36
        "w-14 h-20 md:w-24 md:h-36 bg-white rounded-lg shadow-xl border border-gray-300 relative select-none transition-transform duration-200",
        // Disabled only affects the cursor.
        !disabled ? "cursor-pointer" : "cursor-default",
        playable && !disabled && "ring-4 ring-yellow-400 ring-offset-2"
      )}
    >
      {/* Top Left - 调整字体大小以适应小卡牌 */}
      <div className={clsx("absolute top-0.5 left-0.5 md:top-1 md:left-1 font-bold text-sm md:text-lg leading-none flex flex-col items-center", colorClass)}>
        <div>{card.rank}</div>
        <div>{SUIT_SYMBOLS[card.suit]}</div>
      </div>
      
      {/* Bottom Right (Rotated) */}
      <div className={clsx("absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 font-bold text-sm md:text-lg leading-none rotate-180 flex flex-col items-center", colorClass)}>
        <div>{card.rank}</div>
        <div>{SUIT_SYMBOLS[card.suit]}</div>
      </div>

      {/* Center Big Symbol - 手机端稍微缩小符号 */}
      <div className={clsx("absolute inset-0 flex items-center justify-center text-3xl md:text-5xl", colorClass)}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
    </motion.div>
  );
};