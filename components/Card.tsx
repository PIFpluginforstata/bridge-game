import React from 'react';
import { Card as CardType } from '../types';
import { SUIT_SYMBOLS } from '../constants';
import clsx from 'clsx';

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
      <div className="w-12 h-18 md:w-20 md:h-32 bg-blue-900 rounded-md border border-white shadow-md flex items-center justify-center relative">
        <div className="w-full h-full border-2 border-blue-800 rounded-md opacity-50"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
      </div>
    );
  }

  const isRed = card.suit === 'H' || card.suit === 'D';
  const colorClass = isRed ? 'text-red-600' : 'text-black';

  return (
    <div
      // ✅ 完全移除 motion.div，改用普通 div
      // ✅ 不再有任何动画效果
      onClick={() => !disabled && onClick?.()}
      className={clsx(
        "w-12 h-18 md:w-24 md:h-36 bg-white rounded-md shadow border border-gray-300 relative select-none",
        // ✅ 移除所有 transition 相关的类
        !disabled ? "cursor-pointer" : "cursor-default",
        selected && "ring-2 md:ring-4 ring-yellow-400 z-10", 
        playable && !disabled && !selected && "ring-1 ring-blue-300"
      )}
      // ✅ 添加 inline style 强制禁用任何变换
      style={{ transform: 'none', transition: 'none' }}
    >
      {/* Top Left */}
      <div className={clsx("absolute top-0.5 left-0.5 md:top-1 md:left-1 font-bold text-xs md:text-lg leading-none flex flex-col items-center", colorClass)}>
        <div>{card.rank}</div>
        <div>{SUIT_SYMBOLS[card.suit]}</div>
      </div>
      
      {/* Bottom Right */}
      <div className={clsx("absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 font-bold text-xs md:text-lg leading-none rotate-180 flex flex-col items-center", colorClass)}>
        <div>{card.rank}</div>
        <div>{SUIT_SYMBOLS[card.suit]}</div>
      </div>

      {/* Center Big Symbol */}
      <div className={clsx("absolute inset-0 flex items-center justify-center text-2xl md:text-5xl", colorClass)}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
    </div>
  );
};