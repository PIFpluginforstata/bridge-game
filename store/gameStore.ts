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

// 多服务器配置 - 用户可以选择最适合的服务器
export const SERVER_LIST = [
  {
    name: 'Replit (Default)',
    url: 'https://4d530a6a-be03-452c-8d46-8bc062606e9a-00-jq5yqln28u63.pike.replit.dev',
    region: 'US'
  },
  {
    name: 'Custom Server',
    url: '', // 用户自定义
    region: 'Custom'
  }
];

// 从localStorage读取自定义服务器URL
const getStoredServerUrl = (): string => {
  try {
    return localStorage.getItem('bridge_custom_server') || '';
  } catch {
    return '';
  }
};

// 保存自定义服务器URL
export const saveCustomServerUrl = (url: string) => {
  try {
    localStorage.setItem('bridge_custom_server', url);
  } catch {
    // ignore
  }
};

// 获取当前使用的服务器URL
const getCurrentServerUrl = (): string => {
  const customUrl = getStoredServerUrl();
  return customUrl || SERVER_LIST[0].url;
};

// 连接诊断信息
interface ConnectionDiagnostics {
  latency: number | null;
  serverUrl: string;
  transport: string | null;
  reconnectAttempts: number;
  lastPingTime: number | null;
}

interface GameStore {
  socket: Socket | null;
  myId: string;
  role: PlayerId;
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  errorMessage: string | null;
  diagnostics: ConnectionDiagnostics;

  gameState: GameState;

  joinRoom: (roomId: string, customServerUrl?: string) => void;
  disconnect: () => void;
  sendAction: (action: PlayerAction) => void;
  resetGame: () => void;
  processAction: (action: PlayerAction, fromPlayer: PlayerId) => boolean;
  pingServer: () => void;
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
  diagnostics: {
    latency: null,
    serverUrl: '',
    transport: null,
    reconnectAttempts: 0,
    lastPingTime: null,
  },
  gameState: INITIAL_GAME_STATE,

  joinRoom: (roomId: string, customServerUrl?: string) => {
    // 确定要使用的服务器URL
    const serverUrl = customServerUrl || getCurrentServerUrl();

    // 如果提供了自定义URL，保存它
    if (customServerUrl) {
      saveCustomServerUrl(customServerUrl);
    }

    set({
      status: 'connecting',
      errorMessage: null,
      myId: roomId,
      diagnostics: {
        latency: null,
        serverUrl,
        transport: null,
        reconnectAttempts: 0,
        lastPingTime: null,
      }
    });

    if (get().socket) {
      get().socket?.disconnect();
    }

    console.log('🔗 Connecting to server:', serverUrl);

    // 改进的Socket.io配置 - 针对跨地区连接优化
    const socket = window.io(serverUrl, {
      transports: ['websocket', 'polling'], // WebSocket优先，polling作为备选
      reconnection: true, // 启用自动重连
      reconnectionAttempts: 10, // 最多重连10次
      reconnectionDelay: 1000, // 初始重连延迟1秒
      reconnectionDelayMax: 10000, // 最大重连延迟10秒
      timeout: 30000, // 连接超时30秒（适应高延迟网络）
      forceNew: true, // 强制新连接
    });

    // 连接成功
    socket.on('connect', () => {
      console.log('✅ Connected to server');
      const transport = socket.io?.engine?.transport?.name || 'unknown';
      set(state => ({
        diagnostics: { ...state.diagnostics, transport, reconnectAttempts: 0 }
      }));
      socket.emit('join_room', roomId);
      // 立即测量延迟
      get().pingServer();
    });

    // 连接错误
    socket.on('connect_error', (err: Error) => {
      console.error('❌ Connection failed:', err.message);
      set({
        status: 'error',
        errorMessage: `连接失败: ${err.message}。请检查服务器是否运行，或尝试使用自定义服务器。`
      });
    });

    // 断开连接
    socket.on('disconnect', (reason: string) => {
      console.warn('⚠️ Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // 服务器主动断开，需要手动重连
        set({ status: 'error', errorMessage: '服务器断开连接' });
      } else {
        // 其他原因，Socket.io会自动重连
        set({ status: 'reconnecting' });
      }
    });

    // 重连中
    socket.on('reconnect_attempt', (attempt: number) => {
      console.log('🔄 Reconnecting... attempt', attempt);
      set(state => ({
        status: 'reconnecting',
        diagnostics: { ...state.diagnostics, reconnectAttempts: attempt }
      }));
    });

    // 重连成功
    socket.on('reconnect', () => {
      console.log('✅ Reconnected!');
      set({ status: 'connected' });
      socket.emit('join_room', roomId);
    });

    // 重连失败
    socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed');
      set({
        status: 'error',
        errorMessage: '重连失败。请检查网络连接或尝试使用其他服务器。'
      });
    });

    // Pong响应 - 用于测量延迟
    socket.on('pong_response', (data: { timestamp: number }) => {
      const latency = Date.now() - data.timestamp;
      console.log(`📡 Latency: ${latency}ms`);
      set(state => ({
        diagnostics: { ...state.diagnostics, latency, lastPingTime: Date.now() }
      }));
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

      if (!success) {
        console.warn('⚠️ Received invalid action, requesting state sync');
        socket.emit('sync_request', { roomId });
      }
    });

    socket.on('sync_state', (state: GameState) => {
      console.log('🔄 Synced state');
      set({ gameState: state, status: 'connected' });
    });

    socket.on('sync_request', () => {
      console.log('🔄 Sync requested by opponent');
      if (get().role === 'host') {
        socket.emit('sync_state', { roomId, state: get().gameState });
      }
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }
    set({
      socket: null,
      status: 'idle',
      errorMessage: null,
      gameState: INITIAL_GAME_STATE,
      diagnostics: {
        latency: null,
        serverUrl: '',
        transport: null,
        reconnectAttempts: 0,
        lastPingTime: null,
      }
    });
  },

  pingServer: () => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('ping_request', { timestamp: Date.now() });
    }
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