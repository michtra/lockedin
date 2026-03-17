const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Adjust this to match your React app's URL
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Store room states in memory (in production, you'd want to use Redis or a database)
const roomStates = {};

function getRoomState(roomId) {
  if (!roomStates[roomId]) {
    roomStates[roomId] = {
      images: [],
      drawings: [],
      notes: [],
      timer: {
        mode: 'focus',
        status: 'stopped',
        secondsLeft: 25 * 60,
        focusMinutes: 25,
        breakMinutes: 5,
        startedAt: null
      }
    };
  }
  return roomStates[roomId];
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // New event to send current room state to newly joined users
  socket.on('request-room-state', (roomId) => {
    const roomState = getRoomState(roomId);
    socket.emit('room-state', roomState);
    console.log(`Sent room state to ${socket.id} for room ${roomId}`);
  });

  // Existing drawing event
  socket.on('drawing', (data) => {
    // Store the drawing in room state
    const roomState = getRoomState(data.roomId);
    roomState.drawings.push(data);
    
    socket.to(data.roomId).emit('drawing', data);
  });

  // Enhanced image events with room state management
  socket.on('image-added', (data) => {
    // Store the image in room state
    const roomState = getRoomState(data.roomId);
    roomState.images.push(data.image);
    
    socket.to(data.roomId).emit('image-added', data);
    console.log(`Image added to room ${data.roomId} by ${data.clientId}`);
  });

  socket.on('image-updated', (data) => {
    // Update the image in room state
    const roomState = getRoomState(data.roomId);
    const imageIndex = roomState.images.findIndex(img => img.id === data.image.id);
    if (imageIndex !== -1) {
      roomState.images[imageIndex] = data.image;
    }
    
    socket.to(data.roomId).emit('image-updated', data);
  });

  socket.on('image-deleted', (data) => {
    // Remove the image from room state
    const roomState = getRoomState(data.roomId);
    roomState.images = roomState.images.filter(img => img.id !== data.imageId);
    
    socket.to(data.roomId).emit('image-deleted', data);
  });

  socket.on('timer-action', (data) => {
    const { roomId, action, payload } = data;
    const roomState = getRoomState(roomId);
    const timer = roomState.timer;

    if (action === 'start' || action === 'resume') {
      timer.status = 'running';
      timer.startedAt = Date.now();
      if (payload) {
        timer.secondsLeft = payload.secondsLeft;
        timer.mode = payload.mode;
      }
    } else if (action === 'pause') {
      timer.status = 'paused';
      timer.startedAt = null;
      if (payload) timer.secondsLeft = payload.secondsLeft;
    } else if (action === 'stop') {
      timer.status = 'stopped';
      timer.startedAt = null;
      timer.mode = 'focus';
      timer.secondsLeft = timer.focusMinutes * 60;
    } else if (action === 'settings') {
      timer.focusMinutes = payload.focusMinutes;
      timer.breakMinutes = payload.breakMinutes;
      timer.secondsLeft = payload.secondsLeft;
    } else if (action === 'tick') {
      // Keep server in sync for late joiners
      if (payload) {
        timer.secondsLeft = payload.secondsLeft;
        if (payload.mode) timer.mode = payload.mode;
      }
    }

    socket.to(roomId).emit('timer-sync', roomState.timer);
  });

  socket.on('note-add', (data) => {
    const { roomId, note } = data;
    const roomState = getRoomState(roomId);
    roomState.notes.push(note);
    socket.to(roomId).emit('note-add', note);
  });

  socket.on('note-edit', (data) => {
    const { roomId, id, text } = data;
    const roomState = getRoomState(roomId);
    const note = roomState.notes.find(n => n.id === id);
    if (note) note.text = text;
    socket.to(roomId).emit('note-edit', { id, text });
  });

  socket.on('note-move', (data) => {
    const { roomId, id, column } = data;
    const roomState = getRoomState(roomId);
    const note = roomState.notes.find(n => n.id === id);
    if (note) note.column = column;
    socket.to(roomId).emit('note-move', { id, column });
  });

  socket.on('note-delete', (data) => {
    const { roomId, id } = data;
    const roomState = getRoomState(roomId);
    roomState.notes = roomState.notes.filter(n => n.id !== id);
    socket.to(roomId).emit('note-delete', { id });
  });

  // Enhanced clear event (now also clears room state)
  socket.on('clear', (data) => {
    // Clear room state
    const roomState = getRoomState(data.roomId);
    roomState.images = [];
    roomState.drawings = [];
    
    socket.to(data.roomId).emit('clear', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});