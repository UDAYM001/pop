const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

let players = {};
let currentTurn = "PLAYER 1";

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Assign roles: PLAYER 1 and PLAYER 2
  if (Object.keys(players).length === 0) {
    players[socket.id] = "PLAYER 1";
  } else if (Object.keys(players).length === 1) {
    players[socket.id] = "PLAYER 2";
  }

  const assignedPlayer = players[socket.id];
  socket.emit('assignRole', assignedPlayer);

  if (Object.keys(players).length === 2) {
    currentTurn = "PLAYER 1";
    io.emit('gameReady');
  }

  socket.on('placeLetter', (data) => {
    // Broadcast move + player + pop info
    socket.broadcast.emit('updateGame', {
      ...data,
      player: assignedPlayer
    });
  });

  socket.on('switchTurn', () => {
    currentTurn = currentTurn === "PLAYER 1" ? "PLAYER 2" : "PLAYER 1";
    io.emit('turnUpdate', currentTurn);
  });

  // 🔥 NEW: Chat message handler
  socket.on('sendMessage', (messageData) => {
    socket.broadcast.emit('receiveMessage', {
      ...messageData,
      player: assignedPlayer
    });
  });

  // 🔥 NEW: Handle manual player exit
  socket.on('playerExit', () => {
    console.log(`${assignedPlayer} exited the game manually`);
    io.emit('gameMessage', {
      text: `The game has ended.`,
      type: 'system'
    });
    io.emit('endGame'); // Notify both clients
    io.disconnectSockets(); // Force disconnect all players
  });

  // 🔥 NEW: Handle disconnections
  socket.on('disconnect', () => {
    console.log(`${assignedPlayer} disconnected`);
    io.emit('gameMessage', {
      text: `${assignedPlayer} has left the game.`,
      type: 'system'
    });
    io.emit('endGame');
    io.disconnectSockets();
  });
});

http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});