// store/gameStore.ts
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import { GameState, PlayerId, PlayerAction } from '../types';
import { generateDeck, shuffleDeck, sortHand, canPlayCard, determineTrickWinner } from '../utils/gameLogic';
import { BASE_TRICK_TARGET, TOTAL_TRICKS } from '../constants';

declare global {
  interface Window {
    io: any;
  }
}

const SERVER_URL = 'https://4d530a6a-be03-452c-8d46-8bc062606e9a-00-jq5yqln28u63.pike.replit.dev';

interface GameStore {
  socket: Socket | null;
  myId: string;
  role: PlayerId;
  status: 'idle' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;
  
  gameState: GameState;
  
  joinRoom: (roomId: string) => void;
  sendAction: (action: PlayerAction) => void;
  resetGame: () => void;
  processAction: (action: PlayerAction, fromPlayer: PlayerId) => boolean; // ✅ 返回布尔值
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
  socket: null,
  myId: '',
  role: 'host',
  status: 'idle',
  errorMessage: null,
  gameState: INITIAL_GAME_STATE,

  joinRoom: (roomId: string) => {
    set({ status: 'connecting', errorMessage: null, myId: roomId });
    
    if (get().socket) {
      get().socket?.disconnect();
    }

    const socket = window.io(SERVER_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Connected to server');
      socket.emit('join_room', roomId);
    });

    socket.on('connect_error', (err: Error) => {
      console.error('❌ Connection failed:', err);
      set({ 
        status: 'error', 
        errorMessage: 'Cannot connect to server. Please check if Replit is running.' 
      });
    });

    socket.on('role_assigned', (role: PlayerId) => {
      console.log('🎮 Role assigned:', role);
      set({ role });
      
      if (role === 'host') {
        get().resetGame();
      }
    });

    socket.on('player_connected', () => {
      console.log('👋 Opponent connected!');
      set({ status: 'connected' });
      
      if (get().role === 'host') {
        socket.emit('sync_state', { roomId, state: get().gameState });
      }
    });

    socket.on('error_message', (msg: string) => {
      set({ status: 'error', errorMessage: msg });
    });

    socket.on('game_action', (action: PlayerAction) => {
      console.log('📥 Received action:', action);
      const opponent = get().role === 'host' ? 'peer' : 'host';
      const success = get().processAction(action, opponent);
      
      // ✅ 如果对方发来的动作无效，请求同步状态
      if (!success) {
        console.warn('⚠️ Received invalid action, requesting state sync');
        socket.emit('sync_request', { roomId });
      }
    });

    socket.on('sync_state', (state: GameState) => {
      console.log('🔄 Synced state');
      set({ gameState: state, status: 'connected' });
    });

    // ✅ 处理同步请求
    socket.on('sync_request', () => {
      console.log('🔄 Sync requested by opponent');
      if (get().role === 'host') {
        socket.emit('sync_state', { roomId, state: get().gameState });
      }
    });

    set({ socket });
  },
  
  sendAction: (action) => {
    const { socket, myId, role, processAction } = get();
    
    // ✅ 先处理，检查是否成功
    const success = processAction(action, role);
    
    // ✅ 只有成功时才发送给对方
    if (success) {
      socket?.emit('game_action', { roomId: myId, action });
    } else {
      console.warn('❌ Action rejected, not sending to opponent');
    }
  },
  
  resetGame: () => {
    const { socket, myId } = get();
    const fullDeck = generateDeck();
    const shuffled = shuffleDeck(fullDeck);
    const playingDeck = shuffled.slice(14);
    const hand1 = sortHand(playingDeck.slice(0, 19));
    const hand2 = sortHand(playingDeck.slice(19, 38));
    
    const prevDealer = get().gameState.dealer;
    const newDealer = prevDealer === 'host' ? 'peer' : 'host';
    
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
      tricks: { host: 0, peer: 0 },
      wonCards: { host: [], peer: [] },
      currentTrick: { leader: newDealer, cards: [] },
      trumpBroken: false,
      readyForNext: { host: false, peer: false },
      lastWinner: null,
    };
    
    set({ gameState: newState });
    socket?.emit('sync_state', { roomId: myId, state: newState });
  },
  
  processAction: (action, fromPlayer): boolean => { // ✅ 返回 boolean
    const { gameState, role, resetGame, socket, myId } = get();
    
    // ✅ 严格验证轮次（除了 READY_NEXT）
    if (action.type !== 'READY_NEXT' && gameState.phase !== 'GAME_OVER' && gameState.turn !== fromPlayer) {
      console.warn(`❌ Not ${fromPlayer}'s turn (current: ${gameState.turn})`);
      return false;
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
            if (role === 'host') {
              resetGame();
            }
            return true;
          } else {
            newState.turn = fromPlayer === 'host' ? 'peer' : 'host';
          }
        }
        break;
        
      case 'PLAY_CARD':
        if (!action.payload?.cardId) return false;
        const hand = newState.hands[fromPlayer];
        const card = hand.find(c => c.id === action.payload?.cardId);
        if (!card) {
          console.warn('❌ Card not found in hand');
          return false;
        }
        
        // ✅ 两边都验证！
        const validCheck = canPlayCard(card, hand, newState, fromPlayer);
        if (!validCheck.valid) {
          console.warn(`❌ Invalid card play: ${validCheck.reason}`);
          return false;
        }
        
        newState.hands = { 
          ...newState.hands, 
          [fromPlayer]: hand.filter(c => c.id !== card.id) 
        };
        newState.currentTrick.cards.push({ player: fromPlayer, card });
        
        if (newState.trump !== 'NT' && card.suit === newState.trump) {
          newState.trumpBroken = true;
        }
        
        if (newState.currentTrick.cards.length < 2) {
          newState.turn = fromPlayer === 'host' ? 'peer' : 'host';
        }
        break;
        
      case 'READY_NEXT':
        newState.readyForNext = { 
          ...newState.readyForNext, 
          [fromPlayer]: true 
        };
        
        if (role === 'host' && newState.readyForNext.host && newState.readyForNext.peer) {
          resetGame();
          return true;
        }
        break;
        
      default:
        return false;
    }
    
    set({ gameState: newState });
    
    // Auto-resolve trick
    if (newState.phase === 'PLAYING' && newState.currentTrick.cards.length === 2) {
      setTimeout(() => {
        const current = get().gameState;
        const winner = determineTrickWinner(current.currentTrick.cards, current.trump);
        const wonCards = current.currentTrick.cards.map(c => c.card);
        
        const nextState = { 
          ...current, 
          tricks: { ...current.tricks }, 
          wonCards: { ...current.wonCards } 
        };
        
        nextState.tricks[winner] += 1;
        nextState.wonCards[winner] = [...nextState.wonCards[winner], ...wonCards];
        nextState.lastWinner = winner;
        nextState.turn = winner;
        nextState.currentTrick = { leader: winner, cards: [] };

        const totalTricksPlayed = nextState.tricks.host + nextState.tricks.peer;
        const remainingTricks = TOTAL_TRICKS - totalTricksPlayed;
        const declarer = nextState.declarer!;
        const target = nextState.contractTarget;
        const declarerWins = nextState.tricks[declarer];

        if (declarerWins >= target) {
          nextState.phase = 'GAME_OVER';
        } else if ((declarerWins + remainingTricks) < target) {
          nextState.phase = 'GAME_OVER';
        } else if (remainingTricks === 0) {
          nextState.phase = 'GAME_OVER';
        }
        
        set({ gameState: nextState });
      }, 1500);
    }
    
    return true; // ✅ 成功
  }
}));