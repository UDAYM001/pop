const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// Track connected players
let players = {};
let disconnectedPlayers = {};

let gameState = {
  gridData: Array(20).fill(null).map(() => Array(20).fill("")),
  scores: { "PLAYER 1": 0, "PLAYER 2": 0 },
  currentPlayer: "PLAYER 1"
};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  let assignedPlayer = null;

  // Handle reconnection
  if (disconnectedPlayers[socket.id]) {
    const oldPlayer = disconnectedPlayers[socket.id].player;
    clearTimeout(disconnectedPlayers[socket.id].timeout);
    delete disconnectedPlayers[socket.id];

    players[socket.id] = oldPlayer;
    assignedPlayer = oldPlayer;

    io.emit("gameMessage", {
      text: `${assignedPlayer} has reconnected.`,
      type: "system"
    });

    socket.emit("gameState", gameState);
    socket.emit("turnUpdate", gameState.currentPlayer);
    console.log(`${assignedPlayer} reconnected`);
    return;
  }

  // Assign role
  if (Object.keys(players).length === 0) {
    assignedPlayer = "PLAYER 1";
  } else if (Object.keys(players).length === 1) {
    assignedPlayer = "PLAYER 2";
  } else {
    socket.emit("gameMessage", {
      text: "Game is full.",
      type: "system"
    });
    socket.disconnect();
    return;
  }

  players[socket.id] = assignedPlayer;
  socket.emit("assignRole", assignedPlayer);

  if (Object.keys(players).length === 2) {
    io.emit("gameReady");
    io.emit("turnUpdate", "PLAYER 1");
    gameState.currentPlayer = "PLAYER 1";
  }

  socket.on("placeLetter", (data) => {
    gameState.gridData[data.row][data.col] = data.letter;
    if (data.pops) {
      gameState.scores[data.player] += data.pops.length;
    }

    socket.broadcast.emit("updateGame", {
      ...data,
      player: assignedPlayer
    });
  });

  socket.on("switchTurn", () => {
    gameState.currentPlayer =
      gameState.currentPlayer === "PLAYER 1" ? "PLAYER 2" : "PLAYER 1";
    io.emit("turnUpdate", gameState.currentPlayer);
  });

  socket.on("sendMessage", (messageData) => {
    socket.broadcast.emit("receiveMessage", {
      ...messageData,
      player: assignedPlayer
    });
  });

  socket.on("playerExit", () => {
    console.log(`${assignedPlayer} exited manually`);
    delete players[socket.id];
    io.emit("gameMessage", {
      text: `${assignedPlayer} has left the game.`,
      type: "system"
    });
    io.emit("endGame");
  });

  socket.on("disconnect", () => {
    console.log(`${assignedPlayer} disconnected`);

    io.emit("gameMessage", {
      text: `${assignedPlayer} has disconnected.`,
      type: "system"
    });

    // Mark as disconnected, allow reconnect within 90 seconds
    disconnectedPlayers[socket.id] = {
      player: assignedPlayer,
      timeout: setTimeout(() => {
        delete players[socket.id];
        io.emit("gameMessage", {
          text: `${assignedPlayer} has left permanently.`,
          type: "system"
        });
        io.emit("endGame");
      }, 90000)
    };
  });
});

http.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
