// server.js
// Purpose: Create the HTTP server, attach Socket.IO with proper CORS, and wire all socket events.
// Notes:
// - Consolidates all `io.on('connection')` handlers into a single handler to avoid duplicate listeners.
// - Keeps original behaviors: emitting `clearLocalStorage` on connect, delegating to `handleSocketEvents`,
//   logging hooks (`onAny`, `disconnect`, `error`), and handling `joinGame` by updating the players store.

const http = require('http');
const socketIo = require('socket.io');
const events = require('events');

const app = require('./app'); // Express app
const handleSocketEvents = require('./socketHandlers'); // Socket event domain logic
const { addPlayer, getPlayers } = require('./players'); // Players management used by `joinGame`

// Increase the maximum number of listeners to reduce EventEmitter warnings in large rooms
events.setMaxListeners(20);

const server = http.createServer(app);

// Configure CORS for Socket.IO (client origin must match your deployed client)
const io = socketIo(server, {
  cors: {
    origin: ['https://town-game-client.onrender.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

// ---- Single connection handler (merges the three separate definitions) ----
io.on('connection', (socket) => {
  // console.log('A user connected');
  // Ask client to clear its session/local storage to prevent stale state
  socket.emit('clearLocalStorage');

  // Delegate domain-specific socket events to a dedicated handler module
  handleSocketEvents(socket, io);

  // General diagnostics hooks (kept from original code)
  // console.log(`Client connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    // console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
  });

  socket.on('error', (err) => {
    // console.error(`Socket error: ${err.message}`);
  });

  socket.onAny((event, ...args) => {
    // console.log(`Event received: ${event}`, args);
  });

  // ---- Per-socket events that were mistakenly registered on `io` ----
  // Handle a player joining the lobby
  socket.on('joinGame', (playerName) => {
    addPlayer(playerName, socket.id);
    const { players, firstPlayer } = getPlayers();
    console.log('Players:', players);
    console.log('First Player:', firstPlayer); // verify that the first player's NAME is set correctly
  });
});

// Start HTTP + WS server
server.listen(5000, () => {
  console.log('Server is running on http://localhost:5000');
});
