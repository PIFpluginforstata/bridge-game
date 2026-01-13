import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Store room information
const rooms = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('join_room', (roomId) => {
    console.log(`[Room] ${socket.id} joining room: ${roomId}`);

    if (!rooms.has(roomId)) {
      // First player - becomes host
      rooms.set(roomId, {
        host: socket.id,
        peer: null,
        hostSocket: socket,
        peerSocket: null
      });
      socket.join(roomId);
      socket.roomId = roomId;
      socket.role = 'host';
      socket.emit('role_assigned', 'host');
      console.log(`[Room] ${socket.id} is HOST of room ${roomId}`);
    } else {
      const room = rooms.get(roomId);

      if (room.peer && room.peer !== socket.id) {
        // Room is full
        socket.emit('error_message', 'Room is full. Please try another room.');
        return;
      }

      // Second player - becomes peer
      room.peer = socket.id;
      room.peerSocket = socket;
      socket.join(roomId);
      socket.roomId = roomId;
      socket.role = 'peer';
      socket.emit('role_assigned', 'peer');
      console.log(`[Room] ${socket.id} is PEER of room ${roomId}`);

      // Notify both players
      io.to(roomId).emit('player_connected');
    }
  });

  socket.on('game_action', ({ roomId, action }) => {
    console.log(`[Action] ${socket.id} in room ${roomId}:`, action.type);
    // Broadcast to other players in room
    socket.to(roomId).emit('game_action', action);
  });

  socket.on('sync_state', ({ roomId, state }) => {
    console.log(`[Sync] State sync in room ${roomId}`);
    socket.to(roomId).emit('sync_state', state);
  });

  socket.on('sync_request', ({ roomId }) => {
    console.log(`[Sync] Sync requested in room ${roomId}`);
    socket.to(roomId).emit('sync_request');
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);

    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        if (room.host === socket.id) {
          // Host left - remove room
          rooms.delete(socket.roomId);
          io.to(socket.roomId).emit('error_message', 'Host disconnected. Room closed.');
        } else if (room.peer === socket.id) {
          // Peer left - keep room open
          room.peer = null;
          room.peerSocket = null;
        }
      }
    }
  });
});

// Check if we're in production (built) or development mode
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Serve static files from dist folder
  app.use(express.static(path.join(__dirname, 'dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Production server running on port ${PORT}`);
  });
} else {
  // Development mode - run Vite and proxy
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Socket.io server running on port ${PORT}`);
    console.log(`[Server] Starting Vite dev server...`);

    // Start Vite on a different port
    const vite = spawn('npx', ['vite', '--port', '5173', '--host'], {
      stdio: 'inherit',
      shell: true
    });

    vite.on('error', (err) => {
      console.error('[Vite] Failed to start:', err);
    });

    process.on('SIGINT', () => {
      vite.kill();
      process.exit();
    });
  });

  // Proxy requests to Vite dev server
  app.use(async (req, res, next) => {
    // Skip socket.io requests
    if (req.url.startsWith('/socket.io')) {
      return next();
    }

    try {
      const response = await fetch(`http://localhost:5173${req.url}`, {
        method: req.method,
        headers: req.headers
      });

      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      const body = await response.arrayBuffer();
      res.status(response.status).send(Buffer.from(body));
    } catch (err) {
      // Vite not ready yet, serve a loading page
      if (req.url === '/' || req.url === '/index.html') {
        res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Loading...</title>
              <meta http-equiv="refresh" content="2">
            </head>
            <body style="background: #1a1a2e; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
              <div style="text-align: center;">
                <h1>Starting Bridge Game...</h1>
                <p>Please wait, the server is starting up.</p>
              </div>
            </body>
          </html>
        `);
      } else {
        next();
      }
    }
  });
}
