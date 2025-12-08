import React from 'react';
import { useGameStore } from './store/gameStore';
import { Lobby } from './components/Lobby';
import { Card } from './components/Card';
import { BiddingPanel } from './components/BiddingPanel';
import { SUIT_SYMBOLS } from './constants';
import { Trophy } from 'lucide-react';

const App: React.FC = () => {
  const { gameState, role, myId, status, sendAction, conn } = useGameStore();

  if (status !== 'connected' || !conn) {
    return <Lobby />;
  }

  const myHand = gameState.hands[role];
  const isMyTurn = gameState.turn === role;
  const opponentRole = role === 'host' ? 'peer' : 'host';
  const opponentHandCount = gameState.hands[opponentRole].length;
  
  const myCardInTrick = gameState.currentTrick.cards.find(c => c.player === role);
  const oppCardInTrick = gameState.currentTrick.cards.find(c => c.player === opponentRole);

  const myWonCards = gameState.wonCards[role];
  const oppWonCards = gameState.wonCards[opponentRole];

  // --- 动态重叠逻辑 ---
  // 如果手牌多于 10 张（比如开局19张），使用极度紧凑的间距 (-space-x-[2.8rem])
  // 如果手牌变少了，恢复正常的紧凑间距 (-space-x-8)
  // md:-space-x-12 是电脑端的默认设置，保持不变
  const handSpacingClass = myHand.length > 10 ? '-space-x-[2.8rem]' : '-space-x-8';

  // GAME OVER SCREEN
  if (gameState.phase === 'GAME_OVER') {
        const declarer = gameState.declarer!;
        const contract = gameState.contractTarget;
        const won = gameState.tricks[declarer];
        const success = won >= contract;
        const isDeclarer = role === declarer;
        const iWon = (isDeclarer && success) || (!isDeclarer && !success);

        return (
            <div className="w-full h-screen bg-green-900 flex items-center justify-center p-4 z-[100] relative">
                <div className="bg-white text-black p-8 rounded-2xl max-w-lg w-full text-center shadow-2xl border-4 border-yellow-500">
                    <Trophy className={`w-24 h-24 mx-auto mb-4 ${iWon ? 'text-yellow-500' : 'text-gray-400'}`} />
                    <h2 className="text-5xl font-bold mb-4">{iWon ? "VICTORY" : "DEFEAT"}</h2>
                    <p className="text-xl text-gray-600 mb-8 font-mono bg-gray-100 p-4 rounded">
                        Contract: {gameState.currentBid?.level}{SUIT_SYMBOLS[gameState.currentBid?.suit || 'C'] || ''} ({gameState.contractTarget})<br/>
                        Result: {gameState.tricks[declarer]} tricks
                    </p>
                    <button 
                        onClick={() => sendAction({ type: 'READY_NEXT' })}
                        disabled={gameState.readyForNext[role]}
                        className="w-full bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-xl hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                        {gameState.readyForNext[role] ? "Waiting for Opponent..." : "Play Again"}
                    </button>
                </div>
            </div>
        );
  }

  return (
    <div className="w-full h-screen bg-green-900 flex flex-col overflow-hidden font-sans select-none">
        {/* TEXTURE BACKGROUND */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/felt.png')] z-0"></div>

        {/* --- HEADER / INFO BAR (Fixed at top) --- */}
        <div className="flex-none bg-black/40 text-white p-2 flex justify-between items-center z-10 px-4 text-sm">
            <div className="opacity-70">Room: {myId.slice(0, 4)}...</div>
            <div className="flex gap-4 font-bold">
                <span className="text-yellow-400">You: {gameState.tricks[role]}</span>
                <span className="text-red-400">Opp: {gameState.tricks[opponentRole]}</span>
            </div>
            {gameState.declarer && (
                <div className="bg-white/20 px-2 py-0.5 rounded text-xs">
                    Target: {gameState.contractTarget} ({gameState.declarer === role ? 'YOU' : 'OPP'})
                </div>
            )}
        </div>

        {/* --- TOP SECTION: OPPONENT (25%) --- */}
        <div className="flex-none h-[25%] flex items-center justify-center relative z-10">
            {/* 对手牌也相应缩小间距，保持美观 */}
            <div className="flex -space-x-10 scale-75 md:scale-90 origin-top">
                {Array.from({ length: opponentHandCount }).map((_, i) => (
                    <Card key={i} card={{ id: 'hidden', suit: 'S', rank: 'A', value: 0 }} hidden />
                ))}
            </div>
        </div>

        {/* --- MIDDLE SECTION: TABLE / ACTION (40%) --- */}
        <div className={`flex-1 min-h-0 relative flex items-center justify-center ${gameState.phase === 'BIDDING' ? 'z-30' : 'z-10'}`}>
            
            {/* Won Piles (Left - Opponent) */}
            {gameState.phase === 'PLAYING' && oppWonCards.length > 0 && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-80 scale-75">
                    <div className="relative w-24 h-32">
                         {oppWonCards.slice(-2).map((c, i) => (
                             <div key={c.id} className="absolute inset-0" style={{ transform: `rotate(${(i * 10) - 5}deg) translateY(${i * -5}px)` }}>
                                 <Card card={c} disabled />
                             </div>
                         ))}
                    </div>
                    <span className="text-white text-xs mt-2 bg-black/50 px-2 rounded">Opp Wins</span>
                </div>
            )}

            {/* Won Piles (Right - You) */}
            {gameState.phase === 'PLAYING' && myWonCards.length > 0 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-80 scale-75">
                    <div className="relative w-24 h-32">
                         {myWonCards.slice(-2).map((c, i) => (
                             <div key={c.id} className="absolute inset-0" style={{ transform: `rotate(${(i * 10) - 5}deg) translateY(${i * -5}px)` }}>
                                 <Card card={c} disabled />
                             </div>
                         ))}
                    </div>
                    <span className="text-white text-xs mt-2 bg-black/50 px-2 rounded">Your Wins</span>
                </div>
            )}

            {/* SCENARIO A: BIDDING PHASE */}
            {gameState.phase === 'BIDDING' && (
                <div className="w-full h-full flex items-center justify-center p-2">
                    <BiddingPanel 
                        currentBid={gameState.currentBid}
                        myId={role}
                        turn={gameState.turn}
                        onBid={(bid) => sendAction({ type: 'BID', payload: { bid } })}
                        onPass={() => sendAction({ type: 'PASS' })}
                    />
                </div>
            )}

            {/* SCENARIO B: PLAYING PHASE (THE TRICK) */}
            {gameState.phase === 'PLAYING' && (
                <div className="w-full h-full relative flex items-center justify-center">
                    <div className="w-32 h-32 border-2 border-white/10 rounded-full absolute pointer-events-none opacity-20"></div>

                    {/* Opponent Card */}
                    {oppCardInTrick && (
                        <div className="absolute top-[20%] z-10 animate-slide-in">
                            <Card card={oppCardInTrick.card} />
                        </div>
                    )}

                    {/* My Card */}
                    {myCardInTrick && (
                         <div className="absolute bottom-[20%] z-20 animate-slide-in">
                            <Card card={myCardInTrick.card} />
                         </div>
                    )}

                    <div className="absolute top-2 right-4 text-white/30 text-xs text-right">
                         Contract: {gameState.currentBid?.level}{SUIT_SYMBOLS[gameState.currentBid?.suit || 'C'] || ''}
                         <br/>
                         Trump: {gameState.trumpBroken ? 'Broken' : 'Safe'}
                    </div>
                </div>
            )}
        </div>

        {/* --- BOTTOM SECTION: MY HAND (35%) --- */}
        <div className="flex-none h-[35%] w-full relative z-20 flex items-end justify-center pb-4 px-4 bg-gradient-to-t from-black/40 to-transparent">
             {/* 应用动态间距 class: handSpacingClass 
                移除了 hover:-space-x 效果，防止在手机上误触导致布局炸裂
             */}
             <div className={`flex ${handSpacingClass} md:-space-x-12 transition-all duration-300`}>
                {myHand.map((card) => {
                    const valid = gameState.phase === 'PLAYING' && isMyTurn && !myCardInTrick;
                    return (
                        <Card 
                            key={card.id} 
                            card={card} 
                            playable={valid}
                            disabled={!valid}
                            onClick={() => sendAction({ type: 'PLAY_CARD', payload: { cardId: card.id } })}
                        />
                    );
                })}
            </div>
        </div>
    </div>
  );
};

export default App;