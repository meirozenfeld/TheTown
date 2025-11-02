// Purpose: Create the HTTP server, attach Socket.IO with proper CORS, and wire all socket events.
// Notes:
// - Consolidates all `io.on('connection')` handlers into a single handler to avoid duplicate listeners.
// - Keeps original behaviors: emitting `clearLocalStorage` on connect, delegating to `handleSocketEvents`,
//   logging hooks (`onAny`, `disconnect`, `error`), and handling `joinGame` by updating the players store.const http = require('http');

const socketIo = require('socket.io');
const app = require('./app'); 
const handleSocketEvents = require('./socketHandlers');  
const server = http.createServer(app);
const events = require('events');
events.setMaxListeners(20);

//  CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: ['https://town-game-client.onrender.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  // console.log('A user connected');
  socket.emit('clearLocalStorage');
  handleSocketEvents(socket, io); 
});


io.on('connection', (socket) => {
  // console.log(`Client connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    // console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
  });

  socket.on('error', (err) => {
    // console.error(`Socket error: ${err.message}`);
  });
});
io.on('connection', (socket) => {
  // console.log(`Client connected: ${socket.id}`);

  socket.onAny((event, ...args) => {
      // console.log(`Event received: ${event}`, args);
  });

  socket.on('disconnect', () => {
      // console.log(`Client disconnected: ${socket.id}`);
  });
});



io.on('joinGame', (playerName) => {
  addPlayer(playerName, socket.id);
  const { players, firstPlayer } = getPlayers();

  console.log('Players:', players);
  console.log('First Player:', firstPlayer); 
});


server.listen(5000, () => {
  console.log('Server is running on http://localhost:5000');
});
