import { create } from 'zustand';
import Peer, { DataConnection } from 'peerjs';
import { GameState, PlayerId, PlayerAction, Card } from '../types';
import { generateDeck, shuffleDeck, sortHand, canPlayCard, determineTrickWinner } from '../utils/gameLogic';
import { BASE_TRICK_TARGET, TOTAL_TRICKS } from '../constants';

interface GameStore {
  peer: Peer | null;
  conn: DataConnection | null;
  myId: string;
  peerId: string | null;
  role: PlayerId;
  status: 'idle' | 'initializing' | 'waiting_for_peer' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;
  
  gameState: GameState;
  
  // Actions
  createGame: () => Promise<string>;
  joinGame: (hostId: string) => void;
  sendAction: (action: PlayerAction) => void;
  resetGame: () => void;
  processAction: (action: PlayerAction, fromPlayer: PlayerId) => void;
}

const INITIAL_GAME_STATE: GameState = {
  phase: 'LOBBY',
  hands: { host: [], peer: [] },
  dealer: 'host',
  turn: 'host',
  currentBid: null,
  passCount: 0,
  declarer: null,
  trump: null,
  contractTarget: 0,
  tricks: { host: 0, peer: 0 },
  wonCards: { host: [], peer: [] },
  currentTrick: { leader: 'host', cards: [] },
  trumpBroken: false,
  readyForNext: { host: false, peer: false },
  lastWinner: null,
};

export const useGameStore = create<GameStore>((set, get) => ({
  peer: null,
  conn: null,
  myId: '',
  peerId: null,
  role: 'host',
  status: 'idle',
  errorMessage: null,
  gameState: INITIAL_GAME_STATE,

  createGame: async () => {
    set({ status: 'initializing', errorMessage: null, role: 'host' });
    
    // Destroy old peer if exists
    if (get().peer) get().peer?.destroy();

    // ✅ 修复：添加完整的 PeerJS 配置
    const peer = new Peer(undefined, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { 
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });

    return new Promise((resolve) => {
      peer.on('open', (id) => {
        set({ myId: id, peer, status: 'waiting_for_peer' });
        resolve(id);
      });

      peer.on('error', (err) => {
        set({ status: 'error', errorMessage: 'Connection failed: ' + err.type });
      });

      peer.on('connection', (conn) => {
        conn.on('open', () => {
           // Wait for handshake
           set({ conn, status: 'connected', peerId: conn.peer });
           // Host immediately initializes the game logic but waits to send until requested or stable
           get().resetGame(); 
        });

        conn.on('data', (data: any) => {
          if (data.type === 'ACTION') {
            get().processAction(data.payload, 'peer');
          } else if (data.type === 'SYNC_REQUEST') {
            // Peer is asking for the current state explicitly
            conn.send({ type: 'GAME_STATE_UPDATE', payload: get().gameState });
          }
        });
        
        conn.on('close', () => set({ status: 'error', errorMessage: 'Opponent disconnected' }));
      });
    });
  },

  joinGame: (hostId) => {
    set({ status: 'initializing', errorMessage: null, role: 'peer' });
    if (get().peer) get().peer?.destroy();

    // ✅ 修复：添加完整的 PeerJS 配置
    const peer = new Peer(undefined, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { 
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });

    peer.on('open', (id) => {
      set({ myId: id, peer, status: 'connecting' });
      
      const conn = peer.connect(hostId, { reliable: true });
      
      conn.on('open', () => {
        set({ conn, peerId: hostId, status: 'connected' });
        
        // HANDSHAKE: Explicitly ask host for state to ensure connection is bidirectional
        conn.send({ type: 'SYNC_REQUEST' });
      });

      conn.on('data', (data: any) => {
        if (data.type === 'GAME_STATE_UPDATE') {
          set({ gameState: data.payload });
        }
      });

      conn.on('error', (err) => {
        set({ status: 'error', errorMessage: 'Connection Error' });
      });
      
      conn.on('close', () => set({ status: 'error', errorMessage: 'Host disconnected' }));
    });

    peer.on('error', (err) => {
      set({ status: 'error', errorMessage: 'Could not connect to peer server. ' + err.type });
    });
  },
  
  sendAction: (action) => {
      const { role, conn, processAction } = get();
      if (role === 'host') {
          processAction(action, 'host');
      } else {
          conn?.send({ type: 'ACTION', payload: action });
      }
  },
  
  resetGame: () => {
      const fullDeck = generateDeck();
      const shuffled = shuffleDeck(fullDeck);
      const playingDeck = shuffled.slice(14);
      const hand1 = sortHand(playingDeck.slice(0, 19));
      const hand2 = sortHand(playingDeck.slice(19, 38));
      
      const prevDealer = get().gameState.dealer;
      const newDealer = prevDealer === 'host' ? 'peer' : 'host';
      
      // DEEP RESET: Create a fresh object for every nested property
      // Do NOT spread INITIAL_GAME_STATE to avoid reference reuse bugs
      const newState: GameState = {
          phase: 'BIDDING',
          hands: { host: hand1, peer: hand2 },
          dealer: newDealer,
          turn: newDealer,
          currentBid: null,
          passCount: 0,
          declarer: null,
          trump: null,
          contractTarget: 0,
          tricks: { host: 0, peer: 0 }, // FRESH OBJECT
          wonCards: { host: [], peer: [] }, // FRESH OBJECT
          currentTrick: { leader: newDealer, cards: [] },
          trumpBroken: false,
          readyForNext: { host: false, peer: false }, // FRESH OBJECT
          lastWinner: null,
      };
      
      set({ gameState: newState });
      get().conn?.send({ type: 'GAME_STATE_UPDATE', payload: newState });
  },
  
  processAction: (action, fromPlayer) => {
      const { gameState, role, conn, resetGame } = get();
      
      if (action.type !== 'READY_NEXT' && gameState.phase !== 'GAME_OVER' && gameState.turn !== fromPlayer) {
          return; // Ignore moves out of turn
      }
      
      let newState = { ...gameState };
      
      switch (action.type) {
          case 'BID':
              if (action.payload?.bid) {
                  newState.currentBid = action.payload.bid;
                  newState.turn = fromPlayer === 'host' ? 'peer' : 'host';
                  newState.passCount = 0;
              }
              break;
              
          case 'PASS':
              newState.passCount += 1;
              if (newState.currentBid) {
                  newState.phase = 'PLAYING';
                  newState.declarer = newState.currentBid.bidder;
                  newState.trump = newState.currentBid.suit;
                  newState.contractTarget = BASE_TRICK_TARGET + newState.currentBid.level;
                  newState.turn = newState.declarer;
                  newState.currentTrick = { leader: newState.declarer, cards: [] };
              } else {
                  if (newState.passCount >= 2) {
                      resetGame();
                      return;
                  } else {
                      newState.turn = fromPlayer === 'host' ? 'peer' : 'host';
                  }
              }
              break;
              
          case 'PLAY_CARD':
              if (!action.payload?.cardId) return;
              const hand = newState.hands[fromPlayer];
              const card = hand.find(c => c.id === action.payload?.cardId);
              if (!card) return;
              
              const validCheck = canPlayCard(card, hand, newState, fromPlayer);
              if (!validCheck.valid) return;
              
              newState.hands = { ...newState.hands, [fromPlayer]: hand.filter(c => c.id !== card.id) };
              newState.currentTrick.cards.push({ player: fromPlayer, card });
              
              if (newState.trump !== 'NT' && card.suit === newState.trump) newState.trumpBroken = true;
              
              if (newState.currentTrick.cards.length < 2) {
                  newState.turn = fromPlayer === 'host' ? 'peer' : 'host';
              }
              break;
              
          case 'READY_NEXT':
               newState.readyForNext = { ...newState.readyForNext, [fromPlayer]: true };
               if (newState.readyForNext.host && newState.readyForNext.peer) {
                   resetGame();
                   return;
               }
               break;
      }
      
      set({ gameState: newState });
      conn?.send({ type: 'GAME_STATE_UPDATE', payload: newState });
      
      if (newState.phase === 'PLAYING' && newState.currentTrick.cards.length === 2) {
           setTimeout(() => {
               const current = get().gameState;
               // Double check we are still in playing phase to avoid race conditions
               if (current.phase !== 'PLAYING' || current.currentTrick.cards.length !== 2) return;
               
               const winner = determineTrickWinner(current.currentTrick.cards, current.trump);
               const wonCards = current.currentTrick.cards.map(c => c.card);

               // Create a safe copy of the state structure to avoid mutation issues
               const nextState = { 
                   ...current,
                   tricks: { ...current.tricks },
                   wonCards: { ...current.wonCards } 
               };

               nextState.tricks[winner] += 1;
               
               // Add to history
               nextState.wonCards[winner] = [...nextState.wonCards[winner], ...wonCards];

               nextState.lastWinner = winner;
               nextState.turn = winner;
               nextState.currentTrick = { leader: winner, cards: [] };
               
               // EARLY TERMINATION LOGIC
               const totalTricksPlayed = nextState.tricks.host + nextState.tricks.peer;
               const remainingTricks = TOTAL_TRICKS - totalTricksPlayed;
               const declarer = nextState.declarer!;
               const target = nextState.contractTarget;

               const declarerWins = nextState.tricks[declarer];
               
               // Condition 1: Declarer already won enough
               if (declarerWins >= target) {
                   nextState.phase = 'GAME_OVER';
               }
               // Condition 2: Mathematically impossible for Declarer to win enough
               // Even if declarer wins ALL remaining tricks, they won't reach target
               else if ((declarerWins + remainingTricks) < target) {
                   nextState.phase = 'GAME_OVER';
               }
               // Fallback: All tricks played
               else if (remainingTricks === 0) {
                   nextState.phase = 'GAME_OVER';
               }
               
               set({ gameState: nextState });
               get().conn?.send({ type: 'GAME_STATE_UPDATE', payload: nextState });
           }, 1500);
      }
  }
}));