// app.js (Updated to use settings routes)
const express = require('express');
const cors = require('cors');
const settingsRoutes = require('./routes/settings');

const app = express();
app.use(cors({
  origin: ['https://town-game-client.onrender.com'],
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json());

app.use(settingsRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to The Town Game API!');
});

module.exports = app;
