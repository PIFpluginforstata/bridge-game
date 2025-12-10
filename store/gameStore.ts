// store/gameStore.ts
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, PlayerId, PlayerAction } from '../types';
import { generateDeck, shuffleDeck, sortHand, canPlayCard, determineTrickWinner } from '../utils/gameLogic';
import { BASE_TRICK_TARGET, TOTAL_TRICKS } from '../constants';

// ⚠️⚠️⚠️ 这里填你 Replit 的网址 (不带最后的斜杠)
// 例如: 'https://bridge-server.username.repl.co'
const SERVER_URL = 'https://0aada258-860e-4334-bb8e-7bf259009258-00-1fw4vjdj1i68p.sisko.replit.dev'; 

interface GameStore {
  socket: Socket | null;
  myId: string; // 这里 myId 变成了 房间号 (Room ID)
  role: PlayerId;
  status: 'idle' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;
  
  gameState: GameState;
  
  // Actions
  joinRoom: (roomId: string) => void; // 统一为加入房间
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
  socket: null,
  myId: '',
  role: 'host',
  status: 'idle',
  errorMessage: null,
  gameState: INITIAL_GAME_STATE,

  // Socket.io 只需要一个加入房间的动作，不管是创建还是加入
  joinRoom: (roomId: string) => {
    set({ status: 'connecting', errorMessage: null, myId: roomId });
    
    // 如果已经有连接，先断开
    if (get().socket) {
      get().socket?.disconnect();
    }

    // 连接到 Replit 服务器
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'] // 强制优先使用 websocket，失败降级为轮询
    });

    socket.on('connect', () => {
      console.log('✅ 连上了服务器');
      // 发送加入房间请求
      socket.emit('join_room', roomId);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ 服务器连接失败:', err);
      set({ status: 'error', errorMessage: '无法连接到服务器，请检查 Replit 是否在运行' });
    });

    // 服务器分配角色 (第一个进是 host, 第二个是 peer)
    socket.on('role_assigned', (role: PlayerId) => {
      console.log('🎮 角色分配:', role);
      set({ role });
      
      // 如果我是 Host，并且还没初始化过，或者是重新连接，重置游戏
      if (role === 'host') {
        // Host 负责初始化数据
        get().resetGame(); 
      }
    });

    // 监听对手进入
    socket.on('player_connected', () => {
      console.log('👋 对手已连接!');
      set({ status: 'connected' });
      
      // 如果我是 Host，把当前状态同步给 Peer
      if (get().role === 'host') {
        socket.emit('sync_state', { roomId, state: get().gameState });
      }
    });

    // 监听错误
    socket.on('error_message', (msg: string) => {
      set({ status: 'error', errorMessage: msg });
    });

    // 监听游戏动作 (来自对手)
    socket.on('game_action', (action: PlayerAction) => {
      console.log('收到动作:', action);
      // 这里的 fromPlayer 肯定是对手
      const opponent = get().role === 'host' ? 'peer' : 'host';
      get().processAction(action, opponent);
    });

    // 监听状态同步 (主要给 Peer 用)
    socket.on('sync_state', (state: GameState) => {
      console.log('📥 同步状态');
      set({ gameState: state, status: 'connected' });
    });

    set({ socket });
  },
  
  sendAction: (action) => {
    const { socket, myId, role, processAction } = get();
    
    // 1. 先在本地执行 (乐观更新，让界面不卡顿)
    processAction(action, role);

    // 2. 发送给服务器转发给对手
    socket?.emit('game_action', { roomId: myId, action });
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
    // Host 重置后，广播整个状态给 Peer
    socket?.emit('sync_state', { roomId: myId, state: newState });
  },
  
  processAction: (action, fromPlayer) => {
    const { gameState, role, resetGame, socket, myId } = get();
    
    // 验证逻辑 (保持不变)
    if (action.type !== 'READY_NEXT' && gameState.phase !== 'GAME_OVER' && gameState.turn !== fromPlayer) {
      // 可以在这里加个 return 严格校验，但为了同步流畅，暂时允许通过
    }
    
    let newState = { ...gameState };
    
    // --- 这里的逻辑和你原来的一模一样，直接复用 ---
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
             // 如果我是 Host 且两人都 Pass，我来触发重置
             if (role === 'host') {
                 resetGame();
             }
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
        // 如果是收到的来自对手的动作，我们假设它是合法的（因为对手那边已经校验过了）
        // 如果是自己的动作，需要校验
        if (fromPlayer === role && !validCheck.valid) return;
        
        newState.hands = { ...newState.hands, [fromPlayer]: hand.filter(c => c.id !== card.id) };
        newState.currentTrick.cards.push({ player: fromPlayer, card });
        
        if (newState.trump !== 'NT' && card.suit === newState.trump) {
          newState.trumpBroken = true;
        }
        if (newState.currentTrick.cards.length < 2) {
          newState.turn = fromPlayer === 'host' ? 'peer' : 'host';
        }
        break;
      case 'READY_NEXT':
        newState.readyForNext = { ...newState.readyForNext, [fromPlayer]: true };
        // 只有 Host 负责监控是否开始下一局
        if (role === 'host' && newState.readyForNext.host && newState.readyForNext.peer) {
          resetGame();
          return;
        }
        break;
    }
    
    set({ gameState: newState });
    
    // 自动结算逻辑 (Host 负责结算，为了保持一致性)
    if (newState.phase === 'PLAYING' && newState.currentTrick.cards.length === 2) {
        // 如果我是 Host，我负责计算赢家并广播结果
        // Peer 只需要等待 Host 的 sync_state 即可
        // 但为了动画流畅，Peer 也可以自己算，只要逻辑一致
        setTimeout(() => {
            // 这里为了简单，我们让两边都自己算（只要代码一样，结果就一样）
            const current = get().gameState; 
            // ... (复制之前的结算逻辑)
            const winner = determineTrickWinner(current.currentTrick.cards, current.trump);
            const wonCards = current.currentTrick.cards.map(c => c.card);
            
            const nextState = { ...current, tricks: {...current.tricks}, wonCards: {...current.wonCards} };
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

            if (declarerWins >= target) nextState.phase = 'GAME_OVER';
            else if ((declarerWins + remainingTricks) < target) nextState.phase = 'GAME_OVER';
            else if (remainingTricks === 0) nextState.phase = 'GAME_OVER';
            
            set({ gameState: nextState });
        }, 1500);
    }
  }
}));