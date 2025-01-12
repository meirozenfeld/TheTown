// server.js
const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');  // מייבא את app.js
const handleSocketEvents = require('./socketHandlers');  // מייבא את ההגדרות של socket
const server = http.createServer(app);
const events = require('events');
events.setMaxListeners(20); // קובע את המספר המקסימלי של מאזינים (אפשר לשנות את המספר בהתאם לצורך)

// הגדרת CORS עבור Socket.IO
const io = socketIo(server, {
  cors: {
    origin: ['https://town-game-client.onrender.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }
});

// כאשר משתמש מתחבר, נקרא לפונקציה שתנהל את כל האירועים
io.on('connection', (socket) => {
  // console.log('A user connected');
  socket.emit('clearLocalStorage');
  handleSocketEvents(socket, io);  // כל הלוגיקה לגבי Socket תישלח לפונקציה זו
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
  console.log('First Player:', firstPlayer); // בדוק שהשם הראשון מוגדר נכון
});


server.listen(5000, () => {
  console.log('Server is running on http://localhost:5000');
});
