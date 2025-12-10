import React from 'react';
import { useGameStore } from './store/gameStore';
import { Lobby } from './components/Lobby';
import { Card } from './components/Card';
import { BiddingPanel } from './components/BiddingPanel';
import { SUIT_SYMBOLS } from './constants';
import { Trophy } from 'lucide-react';

const App: React.FC = () => {
  // 👇 修复点1：删掉了 'conn'，因为 Socket.io 版本不需要它
  const { gameState, role, myId, status, sendAction } = useGameStore();

  // 👇 修复点2：只检查 status === 'connected'，不再检查 conn
  if (status !== 'connected') {
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

  // 手机端动态间距：牌多时挤一点
  const handSpacingClass = myHand.length > 10 ? '-space-x-8' : '-space-x-6';

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
                <div className="bg-white text-black p-6 rounded-xl max-w-sm w-full text-center shadow-2xl border-4 border-yellow-500">
                    <Trophy className={`w-16 h-16 mx-auto mb-2 ${iWon ? 'text-yellow-500' : 'text-gray-400'}`} />
                    <h2 className="text-3xl font-bold mb-2">{iWon ? "VICTORY" : "DEFEAT"}</h2>
                    <p className="text-lg text-gray-600 mb-4 font-mono bg-gray-100 p-2 rounded">
                        Contract: {gameState.currentBid?.level}{SUIT_SYMBOLS[gameState.currentBid?.suit || 'C'] || ''} ({gameState.contractTarget})<br/>
                        Result: {gameState.tricks[declarer]} tricks
                    </p>
                    <button 
                        onClick={() => sendAction({ type: 'READY_NEXT' })}
                        disabled={gameState.readyForNext[role]}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {gameState.readyForNext[role] ? "Waiting..." : "Play Again"}
                    </button>
                </div>
            </div>
        );
  }

  return (
    <div className="w-full h-screen bg-green-900 flex flex-col overflow-hidden font-sans select-none">
        {/* TEXTURE BACKGROUND */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/felt.png')] z-0"></div>

        {/* --- HEADER --- */}
        <div className="flex-none bg-black/40 text-white py-1 px-3 flex justify-between items-center z-10 text-xs">
            <div className="opacity-70">Room: {myId}</div>
            <div className="flex gap-3 font-bold">
                <span className="text-yellow-400">You: {gameState.tricks[role]}</span>
                <span className="text-red-400">Opp: {gameState.tricks[opponentRole]}</span>
            </div>
            {gameState.declarer && (
                <div className="bg-white/20 px-2 rounded text-[10px]">
                    Target: {gameState.contractTarget}
                </div>
            )}
        </div>

        {/* --- TOP: OPPONENT --- */}
        <div className="flex-none h-[20%] flex items-center justify-center relative z-10 scale-60 origin-top">
            <div className="flex -space-x-8">
                {Array.from({ length: opponentHandCount }).map((_, i) => (
                    <Card key={i} card={{ id: 'hidden', suit: 'S', rank: 'A', value: 0 }} hidden />
                ))}
            </div>
        </div>

        {/* --- MIDDLE: TABLE --- */}
        <div className={`flex-1 min-h-0 relative flex items-center justify-center ${gameState.phase === 'BIDDING' ? 'z-30' : 'z-10'} scale-90`}>
            {/* Won Piles (Left) */}
            {gameState.phase === 'PLAYING' && oppWonCards.length > 0 && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-60 scale-50 origin-left">
                    <div className="relative w-24 h-32">
                         {oppWonCards.slice(-2).map((c, i) => (
                             <div key={c.id} className="absolute inset-0" style={{ transform: `rotate(${(i * 10) - 5}deg) translateY(${i * -5}px)` }}>
                                 <Card card={c} disabled />
                             </div>
                         ))}
                    </div>
                    <span className="text-white text-xs mt-1 bg-black/50 px-1 rounded">Opp</span>
                </div>
            )}

            {/* Won Piles (Right) */}
            {gameState.phase === 'PLAYING' && myWonCards.length > 0 && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-60 scale-50 origin-right">
                    <div className="relative w-24 h-32">
                         {myWonCards.slice(-2).map((c, i) => (
                             <div key={c.id} className="absolute inset-0" style={{ transform: `rotate(${(i * 10) - 5}deg) translateY(${i * -5}px)` }}>
                                 <Card card={c} disabled />
                             </div>
                         ))}
                    </div>
                    <span className="text-white text-xs mt-1 bg-black/50 px-1 rounded">You</span>
                </div>
            )}

            {/* BIDDING */}
            {gameState.phase === 'BIDDING' && (
                <div className="w-full h-full flex items-center justify-center">
                    <BiddingPanel 
                        currentBid={gameState.currentBid}
                        myId={role}
                        turn={gameState.turn}
                        onBid={(bid) => sendAction({ type: 'BID', payload: { bid } })}
                        onPass={() => sendAction({ type: 'PASS' })}
                    />
                </div>
            )}

            {/* PLAYING */}
            {gameState.phase === 'PLAYING' && (
                <div className="w-full h-full relative flex items-center justify-center">
                    <div className="w-24 h-24 border-2 border-white/10 rounded-full absolute pointer-events-none opacity-20"></div>

                    {oppCardInTrick && (
                        <div className="absolute top-[25%] z-10">
                            <Card card={oppCardInTrick.card} />
                        </div>
                    )}

                    {myCardInTrick && (
                         <div className="absolute bottom-[25%] z-20">
                            <Card card={myCardInTrick.card} />
                         </div>
                    )}

                    <div className="absolute top-0 right-2 text-white/30 text-[10px] text-right">
                         Contract: {gameState.currentBid?.level}{SUIT_SYMBOLS[gameState.currentBid?.suit || 'C'] || ''}
                         <br/>
                         Trump: {gameState.trumpBroken ? 'Broken' : 'Safe'}
                    </div>
                </div>
            )}
        </div>

        {/* --- BOTTOM: MY HAND --- */}
        <div className="flex-none h-[30%] w-full relative z-20 flex items-end justify-center pb-2 px-2 bg-gradient-to-t from-black/40 to-transparent">
             <div className={`flex ${handSpacingClass} md:-space-x-12 scale-90 origin-bottom`}>
                {myHand.map((card) => {
                    const valid = gameState.phase === 'PLAYING' && isMyTurn && !myCardInTrick;
                    return (
                        <Card 
                            key={card.id} 
                            card={card} 
                            playable={valid}
                            disabled={!valid}
                            selected={false}
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