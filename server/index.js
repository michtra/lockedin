// server/index.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve client build (optional if you later build client into dist)
app.use(express.static(path.join(__dirname, '..', 'client')));

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // user joins room (optional: default room)
  socket.on('join', (roomId = 'global') => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`${socket.id} joined ${roomId}`);
  });

  // receive a drawing event and broadcast to other clients in same room
  socket.on('drawing', (data) => {
    // data should include: { roomId, line, color, width, clientId(optional) }
    const roomId = data.roomId || socket.roomId || 'global';
    socket.to(roomId).emit('drawing', data);
  });

  // clear board event
  socket.on('clear', (data) => {
    const roomId = data.roomId || socket.roomId || 'global';
    socket.to(roomId).emit('clear', data);
  });

  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Whiteboard server listening on ${PORT}`);
});
