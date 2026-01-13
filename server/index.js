/**
 * Bridge Duel - Socket.io 信令服务器
 *
 * 部署说明：
 * 1. Railway (推荐): https://railway.app
 *    - 直接从GitHub部署，免费tier可用
 *
 * 2. Render: https://render.com
 *    - 创建Web Service，选择Node环境
 *
 * 3. Fly.io: https://fly.io
 *    - 支持全球多区域部署，延迟更低
 *
 * 4. 自建服务器 (VPS):
 *    - 推荐香港或新加坡节点，适合中国-新加坡连接
 *
 * 本地测试：
 * npm install
 * node index.js
 *
 * 环境变量：
 * PORT - 服务器端口（默认3000）
 */

const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 健康检查端点
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      rooms: Object.keys(rooms).length
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// 创建Socket.io服务器
const io = new Server(server, {
  cors: {
    origin: '*', // 生产环境建议限制来源
    methods: ['GET', 'POST']
  },
  // 针对高延迟网络优化
  pingTimeout: 60000,      // 60秒ping超时
  pingInterval: 25000,     // 25秒ping间隔
  connectTimeout: 30000,   // 30秒连接超时
  transports: ['websocket', 'polling'] // 允许两种传输方式
});

// 房间数据存储
const rooms = {};

io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);

  // 加入房间
  socket.on('join_room', (roomId) => {
    console.log(`[${new Date().toISOString()}] ${socket.id} joining room: ${roomId}`);

    // 初始化房间
    if (!rooms[roomId]) {
      rooms[roomId] = { host: null, peer: null };
    }

    const room = rooms[roomId];

    // 分配角色
    if (!room.host) {
      room.host = socket.id;
      socket.join(roomId);
      socket.roomId = roomId;
      socket.role = 'host';
      socket.emit('role_assigned', 'host');
      console.log(`[${new Date().toISOString()}] ${socket.id} assigned as HOST in ${roomId}`);
    } else if (!room.peer) {
      room.peer = socket.id;
      socket.join(roomId);
      socket.roomId = roomId;
      socket.role = 'peer';
      socket.emit('role_assigned', 'peer');
      console.log(`[${new Date().toISOString()}] ${socket.id} assigned as PEER in ${roomId}`);

      // 通知双方已连接
      io.to(roomId).emit('player_connected');
    } else {
      // 房间已满
      socket.emit('error_message', '房间已满');
      console.log(`[${new Date().toISOString()}] Room ${roomId} is full, rejecting ${socket.id}`);
    }
  });

  // 游戏动作转发
  socket.on('game_action', (data) => {
    const { roomId, action } = data;
    console.log(`[${new Date().toISOString()}] Game action in ${roomId}:`, action.type);
    socket.to(roomId).emit('game_action', action);
  });

  // 状态同步
  socket.on('sync_state', (data) => {
    const { roomId, state } = data;
    console.log(`[${new Date().toISOString()}] State sync in ${roomId}, phase: ${state?.phase}`);
    socket.to(roomId).emit('sync_state', state);
  });

  // 同步请求
  socket.on('sync_request', (data) => {
    const { roomId } = data;
    console.log(`[${new Date().toISOString()}] Sync request in ${roomId}`);
    socket.to(roomId).emit('sync_request');
  });

  // Ping请求 - 用于测量延迟
  socket.on('ping_request', (data) => {
    socket.emit('pong_response', data);
  });

  // 断开连接
  socket.on('disconnect', (reason) => {
    console.log(`[${new Date().toISOString()}] Client disconnected: ${socket.id}, reason: ${reason}`);

    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];

      // 清理房间数据
      if (room.host === socket.id) {
        room.host = null;
      } else if (room.peer === socket.id) {
        room.peer = null;
      }

      // 通知另一个玩家
      socket.to(roomId).emit('player_disconnected');

      // 如果房间空了，删除房间
      if (!room.host && !room.peer) {
        delete rooms[roomId];
        console.log(`[${new Date().toISOString()}] Room ${roomId} deleted (empty)`);
      }
    }
  });
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║       Bridge Duel - Socket.io Server               ║
╠════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                       ║
║  Health check: http://localhost:${PORT}/health        ║
╚════════════════════════════════════════════════════╝
  `);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
