import React, { useState } from 'react';
import { Copy, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export const Lobby: React.FC = () => {
  const { createGame, joinGame, myId, status, errorMessage } = useGameStore();
  const [hostIdInput, setHostIdInput] = useState('');
  const [mode, setMode] = useState<'SELECT' | 'HOST' | 'JOIN'>('SELECT');

  const copyId = () => {
    navigator.clipboard.writeText(myId);
    alert('Copied ID!');
  };

  const handleHost = async () => {
    setMode('HOST');
    await createGame();
  };

  const handleJoin = async () => {
    if (!hostIdInput) return;
    // CRITICAL: Trim whitespace to prevent "Invalid ID" errors
    joinGame(hostIdInput.trim());
  };

  const handleBack = () => {
      window.location.reload(); // Hard reset is safest for P2P cleanup
  };

  if (mode === 'SELECT') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/20">
          <h1 className="text-4xl font-bold text-center mb-2">Bridge Duel</h1>
          <p className="text-center text-gray-200 mb-8">1v1 Online P2P Bridge</p>
          
          <div className="space-y-4">
            <button onClick={handleHost} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl text-xl transition shadow-lg">
              Create Game
            </button>
            <button onClick={() => setMode('JOIN')} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-xl transition shadow-lg">
              Join Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'HOST') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/20 text-center">
          <h2 className="text-2xl font-bold mb-4">Waiting for Player</h2>
          
          {status === 'initializing' && <Loader2 className="animate-spin mx-auto h-8 w-8 mb-4" />}
          
          {myId && (
            <div className="bg-black/30 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-300 mb-2">Send this ID to your friend:</p>
              <div className="flex items-center gap-2 bg-white/10 p-2 rounded">
                <code className="flex-1 text-lg font-mono text-yellow-300 overflow-hidden text-ellipsis">{myId}</code>
                <button onClick={copyId} className="p-2 hover:bg-white/10 rounded"><Copy size={20}/></button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-gray-400">
             {status === 'connected' ? (
                 <span className="text-green-400 font-bold">Connected! Starting...</span>
             ) : (
                 <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Waiting for connection...</span>
                 </>
             )}
          </div>
          
          <button onClick={handleBack} className="mt-8 text-sm text-gray-400 hover:text-white underline">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/20">
        <h2 className="text-2xl font-bold mb-6 text-center">Join Game</h2>
        
        {errorMessage && (
            <div className="bg-red-500/80 p-3 rounded mb-4 flex items-center gap-2 text-sm">
                <AlertCircle size={16}/> {errorMessage}
            </div>
        )}
        
        <input 
          type="text" 
          placeholder="Paste Host ID here"
          value={hostIdInput}
          onChange={(e) => setHostIdInput(e.target.value)}
          className="w-full bg-black/30 border border-white/30 rounded-lg p-4 text-white placeholder-gray-400 mb-4 font-mono text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
        
        <button 
          onClick={handleJoin}
          disabled={!hostIdInput || status === 'connecting'}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-xl transition shadow-lg flex items-center justify-center gap-2"
        >
          {status === 'connecting' ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          Connect
        </button>
        
        <button onClick={handleBack} className="w-full mt-4 text-gray-400 hover:text-white">Back</button>
      </div>
    </div>
  );
};