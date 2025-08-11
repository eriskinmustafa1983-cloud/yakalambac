const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Public klasöründeki dosyaları olduğu gibi sun
app.use(express.static('public'));

let players = {};
let ebeId = null;

function randomColor() {
  const r = Math.floor(Math.random() * 200) + 30;
  const g = Math.floor(Math.random() * 200) + 30;
  const b = Math.floor(Math.random() * 200) + 30;
  return `rgb(${r},${g},${b})`;
}

function assignRoles() {
  const playerIds = Object.keys(players);
  if (playerIds.length === 0) {
    ebeId = null;
    return;
  }

  const randomIndex = Math.floor(Math.random() * playerIds.length);
  ebeId = playerIds[randomIndex];

  let oyuncuSayaci = 1;
  for (const id of playerIds) {
    if (id === ebeId) {
      players[id].name = 'Ebe';
      players[id].frozen = false;
      players[id].color = randomColor();
      players[id].countdown = 0;
    } else {
      players[id].name = 'Oyuncu' + oyuncuSayaci;
      players[id].frozen = false;
      players[id].color = randomColor();
      players[id].countdown = 0;
      oyuncuSayaci++;
    }
  }
}

io.on('connection', socket => {
  console.log('Yeni bağlanan:', socket.id);

  players[socket.id] = {
    id: socket.id,
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 400) + 50,
    color: randomColor(),
    name: '',
    frozen: false,
    countdown: 0,
  };

  assignRoles();

  socket.emit('currentPlayers', players);
  socket.broadcast.emit('newPlayer', players[socket.id]);

  if (socket.id === ebeId) {
    socket.emit('youAreEbe');
  }

  socket.on('playerMovement', movement => {
    const p = players[socket.id];
    if (p && !p.frozen) {
      p.x = movement.x;
      p.y = movement.y;

      if (socket.id === ebeId) {
        for (let id in players) {
          if (id !== ebeId) {
            const other = players[id];
            if (!other.frozen && Math.hypot(other.x - p.x, other.y - p.y) < 30) {
              other.frozen = true;
              other.color = 'black';
              other.countdown = 60;
              io.emit('playerFrozen', other);

              const interval = setInterval(() => {
                if (!other.frozen) {
                  clearInterval(interval);
                  return;
                }
                other.countdown--;
                io.emit('countdownUpdate', { id: other.id, countdown: other.countdown });
                if (other.countdown <= 0) {
                  other.frozen = false;
                  other.color = randomColor();
                  io.emit('playerUnfrozen', other);
                  clearInterval(interval);
                }
              }, 1000);
            }
          }
        }
      } else {
        for (let id in players) {
          const other = players[id];
          if (other.frozen && Math.hypot(other.x - p.x, other.y - p.y) < 30) {
            other.frozen = false;
            other.color = randomColor();
            io.emit('playerUnfrozen', other);
          }
        }
      }

      io.emit('playerMoved', p);
    }
  });

  socket.on('resetGame', () => {
    assignRoles();
    io.emit('gameReset');
    io.emit('updatePlayers', players);
    console.log('Oyun sıfırlandı, yeni ebe:', ebeId);
  });

  socket.on('disconnect', () => {
    console.log('Oyuncu ayrıldı:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);

    const playerIds = Object.keys(players);
    if (playerIds.length === 0) {
      ebeId = null;
      io.emit('gameReset');
      console.log('Tüm oyuncular çıktı, oyun sıfırlandı.');
    } else {
      if (socket.id === ebeId) {
        assignRoles();
        io.emit('updatePlayers', players);
        console.log('Ebe çıktı, yeni ebe:', ebeId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(3000, () => {
  console.log('Sunucu 3000 portunda çalışıyor');
});
